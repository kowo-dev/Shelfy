import type { FeedItem } from '@app/core/services/community/community.model';
import { groupFeed } from './activity-feed.util';

const words = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

let next = 0;

function item(
  type: FeedItem['type'],
  payload: Record<string, unknown> = {},
  overrides: Partial<FeedItem> = {},
): FeedItem {
  next += 1;
  return {
    id: `a${next}`,
    type,
    actor: { id: 'u1', username: 'margot', displayName: 'Margot', avatarUrl: null },
    media: {
      id: 'm1',
      mediaType: 'movie',
      externalId: '1',
      title: 'Dune',
      coverUrl: null,
    } as never,
    reviewId: 'r1',
    payload,
    rating: 9,
    review: null,
    containsSpoilers: false,
    createdAt: '2026-10-27T10:00:00Z',
    ...overrides,
  };
}

const at = (time: string) => ({ createdAt: `2026-10-27T${time}:00Z` });

describe('groupFeed', () => {
  it('names a rating change and keeps the rating from before', () => {
    expect(groupFeed([item('RATED', { rating: 9, previous: 6 })])).toEqual([
      expect.objectContaining({ tags: ['feed.change.rerated'], rating: 9, previous: 6 }),
    ]);
  });

  it('tells a rewatch apart and keeps a first rating plain', () => {
    expect(groupFeed([item('RATED', { rating: 9, previous: 6, rewatch: true })])[0].tags).toEqual([
      'feed.change.rewatched.watch',
    ]);
    expect(groupFeed([item('RATED', { rating: 7, previous: '' })])[0]).toEqual(
      expect.objectContaining({ tags: ['feed.change.rated'], previous: null }),
    );
  });

  it('shows the current rating on a review that came alone', () => {
    const [entry] = groupFeed([
      item('REVIEWED', { action: 'added' }, { review: words('A slow burn'), rating: 8 }),
    ]);

    expect(entry).toEqual(
      expect.objectContaining({
        tags: ['feed.change.reviewed'],
        rating: 8,
        previous: null,
        excerpt: 'A slow burn',
        reviewId: 'r1',
      }),
    );
  });

  it('folds close changes on one title into one row, newest values first', () => {
    const entries = groupFeed([
      item('REVIEWED', { action: 'updated' }, { ...at('12:00'), review: words('Changed my mind') }),
      item('RATED', { rating: 9, previous: 7 }, at('11:30')),
      item('STATUS_CHANGED', { status: 'done' }, at('11:00')),
      item('RATED', { rating: 7, previous: 5 }, at('10:00')),
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        tags: ['feed.change.review_updated', 'feed.change.rerated', 'feed.change.status'],
        rating: 9,
        previous: 5,
        status: 'done',
        excerpt: 'Changed my mind',
      }),
    );
  });

  it('keeps changes apart across people, titles and long gaps', () => {
    const other = { id: 'u2', username: 'hugo', displayName: null, avatarUrl: null };
    const entries = groupFeed([
      item('RATED', { rating: 9, previous: '' }, at('12:00')),
      item('RATED', { rating: 6, previous: '' }, { ...at('11:59'), actor: other }),
      item('RATED', { rating: 8, previous: '' }, at('06:00')),
    ]);

    expect(entries.map((entry) => [entry.username, entry.rating])).toEqual([
      ['margot', 9],
      ['hugo', 6],
      ['margot', 8],
    ]);
  });

  it('skips what it cannot describe', () => {
    expect(
      groupFeed([
        item('RATED', { rating: '', previous: 6 }),
        item('STATUS_CHANGED', { status: 'weird' }),
        item('ADDED', {}, { media: null }),
      ]),
    ).toEqual([]);
  });
});
