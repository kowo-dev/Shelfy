import type { MediaListSummaryResponse } from '@app/core/services/lists/lists.model';
import type { ReviewResponse } from '@app/core/services/users/user-profile.model';
import type { VersusPoolSummaryResponse } from '@app/core/services/versus/versus.model';

export type Creation =
  | { kind: 'list'; id: string; list: MediaListSummaryResponse }
  | { kind: 'versus'; id: string; pool: VersusPoolSummaryResponse }
  | { kind: 'review'; id: string; review: ReviewResponse };

export const asCreations = {
  lists: (lists: MediaListSummaryResponse[]): Creation[] =>
    lists.map((list) => ({ kind: 'list', id: `list-${list.id}`, list })),
  versus: (pools: VersusPoolSummaryResponse[]): Creation[] =>
    pools.map((pool) => ({ kind: 'versus', id: `versus-${pool.id}`, pool })),
  reviews: (reviews: ReviewResponse[]): Creation[] =>
    reviews.map((review) => ({ kind: 'review', id: `review-${review.id}`, review })),
};
