import { effect, inject, Injectable, Injector, signal } from '@angular/core';
import { watchCollectionChanges } from '@shared/utils/collection-change-sync';
import { AuthService } from '@app/core/services/auth/auth';
import { CollectionService } from '@app/core/services/collection/collection';
import type {
  CollectionItemResponse,
  MediaResponse,
} from '@app/core/services/collection/collection.model';

const keyOf = (media: MediaResponse): string =>
  `${media.provider}:${media.mediaType}:${media.externalId}`;

@Injectable({ providedIn: 'root' })
export class ShelfLookupService {
  private readonly collection = inject(CollectionService);
  private readonly auth = inject(AuthService);

  private readonly byKey = signal<Record<string, CollectionItemResponse>>({});
  private readonly requested = new Set<string>();
  private queue: MediaResponse[] = [];

  constructor() {
    effect(() => {
      if (this.auth.currentUser()) return;
      this.byKey.set({});
      this.requested.clear();
    });
    watchCollectionChanges(this.collection, inject(Injector), {
      onCreated: (item) => this.upsert([item]),
      onUpdated: (item) => this.upsert([item]),
      onBulkUpdated: (items) => this.upsert(items),
      onRemoved: (id) => this.remove([id]),
      onBulkRemoved: (ids) => this.remove(ids),
      onCleared: () => this.byKey.set({}),
    });
  }

  find(media: MediaResponse): CollectionItemResponse | null {
    return this.byKey()[keyOf(media)] ?? null;
  }

  request(media: MediaResponse): void {
    const key = keyOf(media);
    if (!this.auth.currentUser() || this.requested.has(key)) return;
    this.requested.add(key);
    this.queue.push(media);
    if (this.queue.length === 1) queueMicrotask(() => this.flush());
  }

  private flush(): void {
    const batch = this.queue;
    this.queue = [];
    this.collection
      .lookupBatch(
        batch.map(({ provider, mediaType, externalId }) => ({ provider, mediaType, externalId })),
      )
      .subscribe({
        next: (found) => this.byKey.update((map) => ({ ...map, ...found })),
        error: () => batch.forEach((media) => this.requested.delete(keyOf(media))),
      });
  }

  private upsert(items: CollectionItemResponse[]): void {
    this.byKey.update((map) => {
      const next = { ...map };
      for (const item of items) next[keyOf(item.media)] = item;
      return next;
    });
  }

  private remove(ids: string[]): void {
    this.byKey.update((map) =>
      Object.fromEntries(Object.entries(map).filter(([, item]) => !ids.includes(item.id))),
    );
  }
}
