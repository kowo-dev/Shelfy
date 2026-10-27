import { featuredMediaBackdropUrl, mediaBackdropUrl } from './media-backdrop.util';

describe('mediaBackdropUrl', () => {
  it('prefers the backdrop and upgrades TMDB renditions', () => {
    expect(
      mediaBackdropUrl({
        coverUrl: 'https://x/cover.jpg',
        metadata: { backdropUrl: 'https://image.tmdb.org/t/p/w500/a.jpg' },
      }),
    ).toBe('https://image.tmdb.org/t/p/original/a.jpg');
  });

  it('falls back to the cover, then to null', () => {
    expect(mediaBackdropUrl({ coverUrl: 'https://x/c.jpg', metadata: null })).toBe(
      'https://x/c.jpg',
    );
    expect(mediaBackdropUrl({ coverUrl: null, metadata: null })).toBeNull();
    expect(mediaBackdropUrl(null)).toBeNull();
  });

  it('selects featured art from any media in a collection', () => {
    expect(
      featuredMediaBackdropUrl([
        { coverUrl: 'https://x/first-cover.jpg', metadata: null },
        {
          coverUrl: 'https://x/second-cover.jpg',
          metadata: { backdropUrl: 'https://x/featured.jpg' },
        },
      ]),
    ).toBe('https://x/featured.jpg');
  });

  it('does not promote a portrait cover to featured backdrop art', () => {
    expect(
      featuredMediaBackdropUrl([
        { coverUrl: 'https://x/first-cover.jpg', metadata: null },
        { coverUrl: 'https://x/second-cover.jpg', metadata: {} },
      ]),
    ).toBeNull();
  });
});
