const TMDB_SIZE = /\/t\/p\/(w\d+|original)\//;
const IGDB_SIZE = /\/t_[a-z0-9_]+\//;
const ANILIST_SIZE = /\/cover\/(medium|large|extraLarge)\//;

export type ImageRendition = 'small' | 'tile' | 'card' | 'wide' | 'hero' | 'full';

const RENDITIONS: Record<ImageRendition, { tmdb: string; igdb: string; anilist?: string }> = {
  small: { tmdb: 'w185', igdb: 't_cover_small' },
  tile: { tmdb: 'w185', igdb: 't_cover_big', anilist: 'medium' },
  card: { tmdb: 'w342', igdb: 't_cover_big_2x', anilist: 'large' },
  wide: { tmdb: 'w780', igdb: 't_screenshot_big' },
  hero: { tmdb: 'w1280', igdb: 't_720p' },
  full: { tmdb: 'original', igdb: 't_1080p' },
};

const HERO_WIDTHS: Record<'tmdb' | 'igdb', [ImageRendition, number][]> = {
  tmdb: [
    ['wide', 780],
    ['hero', 1280],
  ],
  igdb: [
    ['wide', 889],
    ['hero', 1280],
    ['full', 1920],
  ],
};

export function imageRendition(url: string, rendition: ImageRendition): string {
  const { tmdb, igdb, anilist } = RENDITIONS[rendition];
  const resized = url.replace(TMDB_SIZE, `/t/p/${tmdb}/`).replace(IGDB_SIZE, `/${igdb}/`);
  return anilist ? resized.replace(ANILIST_SIZE, `/cover/${anilist}/`) : resized;
}

export function heroSrcset(url: string): string | null {
  const provider = TMDB_SIZE.test(url) ? 'tmdb' : IGDB_SIZE.test(url) ? 'igdb' : null;
  if (!provider) return null;
  return HERO_WIDTHS[provider]
    .map(([rendition, width]) => `${imageRendition(url, rendition)} ${width}w`)
    .join(', ');
}
