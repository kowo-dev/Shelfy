import { DestroyRef, type Injector } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CollectionService } from '@app/core/services/collection/collection';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';

export interface CollectionChangeHandlers {
  onCreated: (item: CollectionItemResponse) => void;
  onUpdated: (item: CollectionItemResponse) => void;
  onRemoved: (id: string) => void;
  onBulkUpdated: (items: CollectionItemResponse[]) => void;
  onBulkRemoved: (ids: string[]) => void;
  onCleared: () => void;
  onChangeApplied: () => void;
}

export function watchCollectionChanges(
  collectionService: CollectionService,
  injector: Injector,
  handlers: Partial<CollectionChangeHandlers>,
): void {
  const onBulkUpdated =
    handlers.onBulkUpdated ?? ((items) => items.forEach((item) => handlers.onUpdated?.(item)));
  const onBulkRemoved =
    handlers.onBulkRemoved ?? ((ids) => ids.forEach((id) => handlers.onRemoved?.(id)));
  collectionService.changes
    .pipe(takeUntilDestroyed(injector.get(DestroyRef)))
    .subscribe((event) => {
      if (event.type === 'removed') {
        handlers.onRemoved?.(event.id);
      } else if (event.type === 'created') {
        handlers.onCreated?.(event.item);
      } else if (event.type === 'cleared') {
        handlers.onCleared?.();
      } else if (event.type === 'bulkUpdated') {
        onBulkUpdated(event.items);
      } else if (event.type === 'bulkRemoved') {
        onBulkRemoved(event.ids);
      } else {
        handlers.onUpdated?.(event.item);
      }
      handlers.onChangeApplied?.();
    });
}
