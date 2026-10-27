import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { shelfStats } from './friend-profile-stats.util';

describe('shelfStats', () => {
  const item = (mediaType: string, status: string) =>
    ({ media: { mediaType }, status }) as unknown as CollectionItemResponse;

  it('counts the given titles by type, by status and by both', () => {
    const stats = shelfStats([
      item('movie', 'done'),
      item('movie', 'planned'),
      item('game', 'done'),
    ]);

    expect(stats.total).toBe(3);
    expect(stats.countsByMediaType).toEqual({ movie: 2, game: 1 });
    expect(stats.countsByStatus).toEqual({ done: 2, planned: 1 });
    expect(stats.countsByMediaTypeAndStatus).toEqual({
      movie: { done: 1, planned: 1 },
      game: { done: 1 },
    });
  });
});
