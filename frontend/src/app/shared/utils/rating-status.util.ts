import type { UserMediaStatus } from '@app/core/services/collection/collection.model';

export function statusAfterRating(
  current: UserMediaStatus | null,
  rating: number | null,
): UserMediaStatus | null {
  if (rating === null) return null;
  return current === null || current === 'planned' ? 'done' : null;
}
