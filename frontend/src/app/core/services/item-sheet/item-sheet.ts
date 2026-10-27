import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import type {
  CollectionItemResponse,
  UserMediaStatus,
} from '@app/core/services/collection/collection.model';

@Injectable({ providedIn: 'root' })
export class ItemSheetService {
  readonly item = signal<CollectionItemResponse | null>(null);
  readonly bulk = signal<{ items: CollectionItemResponse[]; statuses: UserMediaStatus[] } | null>(
    null,
  );
  readonly bulkApplied = new Subject<CollectionItemResponse[]>();
  readonly updated = new Subject<CollectionItemResponse>();

  open(item: CollectionItemResponse): void {
    this.bulk.set(null);
    this.item.set(item);
  }

  openBulk(items: CollectionItemResponse[], statuses: UserMediaStatus[]): void {
    this.item.set(null);
    this.bulk.set({ items, statuses });
  }

  close(): void {
    this.item.set(null);
    this.bulk.set(null);
  }

  notifyUpdated(item: CollectionItemResponse): void {
    if (this.item()?.id === item.id) this.item.set(item);
    this.updated.next(item);
  }
}
