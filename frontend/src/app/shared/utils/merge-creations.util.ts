import type { MediaListResponse } from '@app/core/services/lists/lists.model';
import type { ReviewResponse } from '@app/core/services/users/user-profile.model';
import type { VersusPoolSummaryResponse } from '@app/core/services/versus/versus.model';

export type MergedCreation =
  | { kind: 'review'; id: string; createdAt: string; review: ReviewResponse }
  | { kind: 'list'; id: string; createdAt: string; list: MediaListResponse }
  | { kind: 'versus'; id: string; createdAt: string; pool: VersusPoolSummaryResponse };

export function mergeCreations(
  lists: readonly MediaListResponse[],
  pools: readonly VersusPoolSummaryResponse[],
  reviews: readonly ReviewResponse[] = [],
): MergedCreation[] {
  const all: MergedCreation[] = [
    ...reviews.map((review) => ({
      kind: 'review' as const,
      id: review.id,
      createdAt: review.createdAt,
      review,
    })),
    ...lists.map((list) => ({
      kind: 'list' as const,
      id: list.id,
      createdAt: list.createdAt,
      list,
    })),
    ...pools.map((pool) => ({
      kind: 'versus' as const,
      id: pool.id,
      createdAt: pool.createdAt,
      pool,
    })),
  ];
  return all.sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '') || 0);
}
