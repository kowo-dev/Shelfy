import { heroSrcset, imageRendition } from './image-rendition.util';

describe('imageRendition', () => {
  it('resizes TMDB images', () => {
    expect(imageRendition('https://image.tmdb.org/t/p/w500/a.jpg', 'card')).toBe(
      'https://image.tmdb.org/t/p/w342/a.jpg',
    );
    expect(imageRendition('https://image.tmdb.org/t/p/w342/a.jpg', 'full')).toBe(
      'https://image.tmdb.org/t/p/original/a.jpg',
    );
  });

  it('resizes IGDB images', () => {
    expect(
      imageRendition('https://images.igdb.com/igdb/image/upload/t_1080p/co1.jpg', 'card'),
    ).toBe('https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co1.jpg');
    expect(
      imageRendition('https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg', 'small'),
    ).toBe('https://images.igdb.com/igdb/image/upload/t_cover_small/co1.jpg');
  });

  it('shrinks AniList covers only for tiles', () => {
    const url = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1.jpg';
    expect(imageRendition(url, 'tile')).toBe(
      'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx1.jpg',
    );
    expect(imageRendition(url, 'card')).toBe(url);
  });

  it('builds a hero srcset for TMDB and IGDB art', () => {
    expect(heroSrcset('https://image.tmdb.org/t/p/original/a.jpg')).toBe(
      'https://image.tmdb.org/t/p/w780/a.jpg 780w, https://image.tmdb.org/t/p/w1280/a.jpg 1280w',
    );
    expect(heroSrcset('https://images.igdb.com/igdb/image/upload/t_1080p/ar1.jpg')).toBe(
      'https://images.igdb.com/igdb/image/upload/t_screenshot_big/ar1.jpg 889w, https://images.igdb.com/igdb/image/upload/t_720p/ar1.jpg 1280w, https://images.igdb.com/igdb/image/upload/t_1080p/ar1.jpg 1920w',
    );
    expect(heroSrcset('https://example.com/banner.jpg')).toBeNull();
  });

  it('leaves other hosts untouched', () => {
    const url = 'https://example.com/covers/1-L.jpg';
    expect(imageRendition(url, 'card')).toBe(url);
  });
});
