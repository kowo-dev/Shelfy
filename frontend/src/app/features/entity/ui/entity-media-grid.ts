import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  input,
  output,
  signal,
  type TemplateRef,
} from '@angular/core';
import { CollectionService } from '@app/core/services/collection/collection';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { MediaCardComponent } from '@shared/ui/media-card/media-card';
import { watchCollectionChanges } from '@shared/utils/collection-change-sync';

const LOOKUP_BATCH = 200;

export type EntityItemFilter = (item: CollectionItemResponse, owned: boolean) => boolean;

export function entityItemKey(item: CollectionItemResponse): string {
  return `${item.media.provider}:${item.media.mediaType}:${item.media.externalId}`;
}

@Component({
  selector: 'shelfy-entity-media-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MediaCardComponent, NgTemplateOutlet],
  template: `
    <div class="poster-grid" [attr.data-size]="posterSize() ? 'l' : null">
      @for (item of shownItems(); track item.id) {
        <shelfy-media-card
          [item]="displayItem(item)"
          [subtitle]="role(item)"
          [tinted]="true"
          [addable]="!overlay() && !selectionMode()"
          [selectionMode]="selectionMode()"
          [selected]="selectedIds().has(item.media.id)"
          (selectionToggle)="selectionToggle.emit(item.media.id)"
        >
          @if (overlay(); as template) {
            <ng-container
              ngProjectAs="[cardOverlay]"
              [ngTemplateOutlet]="template"
              [ngTemplateOutletContext]="{ $implicit: item }"
            />
          }
        </shelfy-media-card>
      }
    </div>
  `,
})
export class EntityMediaGridComponent {
  private readonly collection = inject(CollectionService);

  readonly items = input.required<CollectionItemResponse[]>();
  readonly posterSize = input(false);
  readonly visible = input<EntityItemFilter | null>(null);
  readonly owned = output<ReadonlySet<string>>();

  readonly overlay = input<TemplateRef<{ $implicit: CollectionItemResponse }> | null>(null);
  readonly selectionMode = input(false);
  readonly selectedIds = input<ReadonlySet<string>>(new Set());
  readonly selectionToggle = output<string>();

  private readonly shelfItems = signal<Record<string, CollectionItemResponse>>({});
  private readonly checkedKeys = new Set<string>();

  readonly shownItems = computed(() => {
    const visible = this.visible();
    if (!visible) return this.items();
    const owned = this.shelfItems();
    return this.items().filter((item) => visible(item, owned[this.key(item)] !== undefined));
  });

  constructor() {
    watchCollectionChanges(this.collection, inject(Injector), {
      onCreated: (item) => this.upsert([item]),
      onUpdated: (item) => this.upsert([item]),
      onBulkUpdated: (items) => this.upsert(items),
      onRemoved: (id) => this.removeIds([id]),
      onBulkRemoved: (ids) => this.removeIds(ids),
      onCleared: () => this.shelfItems.set({}),
    });
    effect(() => this.owned.emit(new Set(Object.keys(this.shelfItems()))));
    effect(() => {
      const pendingItems = this.items().filter((item) => !this.checkedKeys.has(this.key(item)));
      if (pendingItems.length === 0) return;
      pendingItems.forEach((item) => this.checkedKeys.add(this.key(item)));
      for (let start = 0; start < pendingItems.length; start += LOOKUP_BATCH) {
        this.lookup(pendingItems.slice(start, start + LOOKUP_BATCH));
      }
    });
  }

  displayItem(item: CollectionItemResponse): CollectionItemResponse {
    return this.shelfItems()[this.key(item)] ?? item;
  }

  role(item: CollectionItemResponse): string | null {
    const role = item.media.metadata?.['role'];
    return typeof role === 'string' && role.trim() ? role : null;
  }

  private lookup(batch: CollectionItemResponse[]): void {
    this.collection
      .lookupBatch(
        batch.map((item) => ({
          provider: item.media.provider,
          mediaType: item.media.mediaType,
          externalId: item.media.externalId,
        })),
      )
      .subscribe({
        next: (found) => this.shelfItems.update((current) => ({ ...current, ...found })),
        error: () => batch.forEach((item) => this.checkedKeys.delete(this.key(item))),
      });
  }

  private upsert(changed: CollectionItemResponse[]): void {
    const keys = new Set(this.items().map((item) => this.key(item)));
    const relevant = changed.filter((item) => keys.has(this.key(item)));
    if (relevant.length === 0) return;
    this.shelfItems.update((current) => {
      const next = { ...current };
      for (const item of relevant) next[this.key(item)] = item;
      return next;
    });
  }

  private removeIds(ids: string[]): void {
    this.shelfItems.update((current) =>
      Object.fromEntries(Object.entries(current).filter(([, item]) => !ids.includes(item.id))),
    );
  }

  private key(item: CollectionItemResponse): string {
    return entityItemKey(item);
  }
}
