import { creationView } from './creation-view';

const media = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `Title ${id}`,
  coverUrl: `cover-${id}.jpg`,
  isAdult: false,
  metadata: { backdropUrl: `back-${id}.jpg` },
  ...overrides,
});

const summary = (overrides: Record<string, unknown> = {}) => ({
  id: 'l1',
  name: 'Best of',
  description: 'desc',
  creatorUsername: 'kowo',
  creatorAvatarUrl: 'a.png',
  likeCount: 3,
  visibility: 'public',
  updatedAt: '2024-01-01',
  itemCount: 10,
  previewMedia: [media('1'), media('2'), media('3'), media('4'), media('5')],
  ...overrides,
});

describe('creationView', () => {
  it('has nothing to show without a source', () => {
    expect(creationView({})).toBeNull();
    expect(creationView({ list: null, pool: null, review: null })).toBeNull();
  });

  describe('list', () => {
    it('shows four covers and the item count', () => {
      const view = creationView({ list: summary() as never })!;

      expect(view).toMatchObject({
        kind: 'list',
        route: ['/lists', 'l1'],
        title: 'Best of',
        creator: 'kowo',
        count: 10,
        countKey: 'community.titles_count',
        likes: 3,
        gated: false,
      });
      expect(view.covers).toHaveLength(4);
    });

    it('counts the titles of a full list, which has no preview or count', () => {
      const full = {
        id: 'l1',
        name: 'Best of',
        description: null,
        creatorUsername: 'kowo',
        creatorAvatarUrl: null,
        likeCount: 0,
        visibility: 'public',
        updatedAt: '2024-01-01',
        media: [media('1'), media('2')],
      };

      const view = creationView({ list: full as never })!;

      expect(view.count).toBe(2);
      expect(view.covers).toHaveLength(2);
    });
  });

  describe('versus', () => {
    const pool = (entries: unknown[]) => ({
      id: 'p1',
      name: 'Openings',
      description: null,
      creatorUsername: 'kowo',
      creatorAvatarUrl: null,
      itemCount: 8,
      likeCount: 2,
      visibility: 'private',
      updatedAt: '2024-02-02',
      previewEntries: entries,
    });

    it('uses the first two entries, from the linked title when there is one', () => {
      const view = creationView({
        pool: pool([
          { title: 'A', coverUrl: 'a.jpg', media: media('1') },
          { title: 'Clip', coverUrl: 'clip.jpg', media: null },
          { title: 'C', coverUrl: 'c.jpg', media: media('3') },
        ]) as never,
      })!;

      expect(view).toMatchObject({
        kind: 'versus',
        route: ['/versus', 'p1'],
        countKey: 'community.contenders_count',
        count: 8,
      });
      expect(view.covers).toEqual([
        { url: 'cover-1.jpg', adult: false, title: 'Title 1' },
        { url: 'clip.jpg', adult: false, title: 'Clip' },
      ]);
    });
  });

  describe('review', () => {
    const review = (overrides: Record<string, unknown> = {}) => ({
      id: 'r1',
      media: media('1'),
      displayName: null,
      username: 'kowo',
      avatarUrl: null,
      likeCount: 5,
      updatedAt: '2024-03-03',
      content: { type: 'doc', content: [] },
      containsSpoilers: true,
      rating: 9,
      ...overrides,
    });

    it('shows the title, the rating and the backdrop of the title', () => {
      const view = creationView({ review: review() as never })!;

      expect(view).toMatchObject({
        kind: 'review',
        route: ['/reviews', 'r1'],
        title: 'Title 1',
        rating: 9,
        creator: 'kowo',
        gated: false,
        count: 0,
      });
      expect(view.covers).toEqual([{ url: 'back-1.jpg', adult: false, title: 'Title 1' }]);
    });

    it('prefers the display name and gates an adult title with no visible name', () => {
      const view = creationView({
        review: review({
          displayName: 'Kowo',
          media: media('1', { isAdult: true, title: '' }),
          rating: undefined,
        }) as never,
      })!;

      expect(view.creator).toBe('Kowo');
      expect(view.gated).toBe(true);
      expect(view.rating).toBeNull();
    });
  });

  it('prefers a versus over a review over a list when several are given', () => {
    const both = creationView({
      list: summary() as never,
      review: { id: 'r', media: media('1'), content: { type: 'doc', content: [] } } as never,
    })!;

    expect(both.kind).toBe('review');
  });
});
