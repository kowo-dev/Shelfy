import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { arrangeFeed, feedTypes, isFeedKind } from './home-feed';

const TODAY = '2026-10-25';

const item = (
  id: string,
  releaseDate: string | null,
  rating: number | null = null,
  type = 'movie',
): CollectionItemResponse =>
  ({
    id,
    rating,
    media: {
      provider: 'tmdb',
      mediaType: type,
      externalId: id,
      title: id,
      coverUrl: `${id}.jpg`,
      metadata: releaseDate ? { releaseDate } : {},
    },
  }) as unknown as CollectionItemResponse;

describe('feedTypes', () => {
  it('mixes the screen, game and anime feeds for all, without manga in upcoming ones', () => {
    expect(feedTypes('trending', 'all')).toEqual(['movie', 'tv_show', 'game', 'anime']);
    expect(feedTypes('soon', 'manga')).toEqual([]);
    expect(feedTypes('top_rated', 'manga')).toEqual(['manga']);
  });

  it('only knows the home feeds', () => {
    expect(isFeedKind('soon')).toBe(true);
    expect(isFeedKind('bogus')).toBe(false);
  });
});

describe('arrangeFeed', () => {
  it('orders upcoming releases by date for coming soon and drops past ones', () => {
    const lists = [
      [item('b', '2026-12-01'), item('past', '2026-10-01')],
      [item('a', '2026-11-01')],
    ];

    expect(arrangeFeed('soon', lists, TODAY).map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('orders releases newest first without future dates', () => {
    const lists = [
      [item('old', '2026-09-01'), item('soon', '2026-11-01'), item('new', '2026-10-20')],
    ];

    expect(arrangeFeed('new', lists, TODAY).map((entry) => entry.id)).toEqual(['new', 'old']);
  });

  it('alternates mixed top rated feeds so no medium takes over, and keeps each title once', () => {
    const lists = [
      [item('film', null, 8.6), item('twice', null, 8)],
      [item('game', null, 9.6, 'game'), item('twice', null, 8)],
    ];

    expect(arrangeFeed('top_rated', lists, TODAY).map((entry) => entry.id)).toEqual([
      'film',
      'game',
      'twice',
    ]);
  });
});
