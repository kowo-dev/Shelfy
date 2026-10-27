import { effect, signal, type Injector, type WritableSignal } from '@angular/core';
import { CollectionService } from '@app/core/services/collection/collection';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import type { SearchResult } from '@app/core/services/search/search.model';
import { watchCollectionChanges } from '@shared/utils/collection-change-sync';

export function resultKey(result: SearchResult): string {
  return `${result.provider}:${result.mediaType}:${result.externalId}`;
}

function collectionItemKey(item: CollectionItemResponse): string {
  return `${item.media.provider}:${item.media.mediaType}:${item.media.externalId}`;
}

export interface SearchCollectionSyncDependencies {
  collectionService: CollectionService;
  allResults: WritableSignal<SearchResult[]>;
  injector: Injector;
}

export interface SearchCollectionSync {
  collectionItemByKey: WritableSignal<Record<string, CollectionItemResponse>>;
}

export function createSearchCollectionSync(
  dependencies: SearchCollectionSyncDependencies,
): SearchCollectionSync {
  const { collectionService, allResults, injector } = dependencies;

  const collectionItemByKey = signal<Record<string, CollectionItemResponse>>({});
  const loadingCollectionKeys = new Set<string>();

  function applyUpsert(item: CollectionItemResponse): void {
    const key = collectionItemKey(item);
    collectionItemByKey.update((map) => ({ ...map, [key]: item }));
    allResults.set(
      allResults().map((entry) =>
        resultKey(entry) === key ? { ...entry, isInCollection: true } : entry,
      ),
    );
  }

  function applyRemoval(id: string): void {
    collectionItemByKey.update((map) => {
      const next = { ...map };
      for (const [key, item] of Object.entries(next)) {
        if (item.id === id) delete next[key];
      }
      return next;
    });
    allResults.set(
      allResults().map((entry) =>
        collectionItemByKey()[resultKey(entry)] === undefined && entry.isInCollection
          ? { ...entry, isInCollection: false }
          : entry,
      ),
    );
  }

  function applyClear(): void {
    collectionItemByKey.set({});
    allResults.set(allResults().map((entry) => ({ ...entry, isInCollection: false })));
  }

  effect(
    () => {
      const pending = allResults().filter((result) => {
        if (!result.isInCollection) return false;
        const key = resultKey(result);
        return !collectionItemByKey()[key] && !loadingCollectionKeys.has(key);
      });
      if (pending.length === 0) return;

      for (const result of pending) {
        loadingCollectionKeys.add(resultKey(result));
      }
      collectionService
        .lookupBatch(
          pending.map((result) => ({
            provider: result.provider,
            mediaType: result.mediaType,
            externalId: result.externalId,
          })),
        )
        .subscribe({
          next: (found) => {
            for (const result of pending) loadingCollectionKeys.delete(resultKey(result));
            if (Object.keys(found).length > 0) {
              collectionItemByKey.update((map) => ({ ...map, ...found }));
            }
          },
          error: () => {
            for (const result of pending) loadingCollectionKeys.delete(resultKey(result));
          },
        });
    },
    { injector },
  );

  watchCollectionChanges(collectionService, injector, {
    onCreated: applyUpsert,
    onUpdated: applyUpsert,
    onRemoved: applyRemoval,
    onBulkUpdated: (items) => items.forEach(applyUpsert),
    onBulkRemoved: (ids) => ids.forEach(applyRemoval),
    onCleared: applyClear,
    onChangeApplied: () => {},
  });

  return { collectionItemByKey };
}
