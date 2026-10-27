import type {
  CollectionItemResponse,
  CollectionStatsResponse,
} from '@app/core/services/collection/collection.model';

export function shelfStats(items: CollectionItemResponse[]): CollectionStatsResponse {
  const stats: Required<Omit<CollectionStatsResponse, 'averageRating'>> = {
    countsByMediaType: {},
    total: items.length,
    countsByStatus: {},
    countsByMediaTypeAndStatus: {},
  };
  for (const { media, status } of items) {
    const type = media.mediaType;
    stats.countsByMediaType[type] = (stats.countsByMediaType[type] ?? 0) + 1;
    stats.countsByStatus[status] = (stats.countsByStatus[status] ?? 0) + 1;
    const byStatus = (stats.countsByMediaTypeAndStatus[type] ??= {});
    byStatus[status] = (byStatus[status] ?? 0) + 1;
  }
  return stats;
}
