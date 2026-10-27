import { computed, signal, type Signal } from '@angular/core';
import { CollectionService } from '@app/core/services/collection/collection';
import type {
  CollectionStatsResponse,
  MediaType,
} from '@app/core/services/collection/collection.model';
import { subscribeWithLoading } from '@shared/utils/loadable-state.util';

export interface CollectionMetadataState {
  stats: Signal<CollectionStatsResponse | null>;
  mediaTypeCounts: Signal<Partial<Record<MediaType, number>>>;
  mediaTypeTotal: Signal<number | null>;
  load: () => void;
  reloadStats: () => void;
}

export function createCollectionMetadataState(
  collectionService: CollectionService,
): CollectionMetadataState {
  const stats = signal<CollectionStatsResponse | null>(null);
  const mediaTypeCounts = computed(() => stats()?.countsByMediaType ?? {});
  const mediaTypeTotal = computed(() => stats()?.total ?? null);

  function reloadStats(): void {
    subscribeWithLoading(collectionService.stats(), stats.set, () => {});
  }

  return {
    stats: stats.asReadonly(),
    mediaTypeCounts,
    mediaTypeTotal,
    load: reloadStats,
    reloadStats,
  };
}
