import type { TranslateService } from '@app/core/services/translate/translate';
import { buildCatalogRating, buildHeroMeta, buildMediaFacts } from './media-detail-stats.util';
import { buildMediaDetailView, type MediaDetailView } from './media-detail-view.util';

const translate = {
  get: (key: string) => key,
  lang: () => 'en',
} as unknown as TranslateService;

const services = {
  tmdb: { imageUrl: () => null },
  igdb: { imageUrl: () => null },
} as never;

function emptyView(overrides: Partial<MediaDetailView> = {}): MediaDetailView {
  const base = buildMediaDetailView(
    'movie',
    {
      movie: null,
      tvShow: null,
      game: null,
      animeDetail: null,
      mangaDetail: null,
    },
    services,
  );
  return { ...base, ...overrides };
}

const format = (iso: string) => `on ${iso}`;
const facts = (overrides: Partial<MediaDetailView>) =>
  buildMediaFacts(emptyView(overrides), translate, format);

describe('buildMediaFacts', () => {
  it('has no fact for a title nothing is known about', () => {
    expect(facts({})).toEqual([]);
  });

  it('formats the release date and marks the end date as secondary', () => {
    expect(facts({ releaseDate: '2021-10-22', endDate: '2022-01-01' })).toEqual([
      { label: 'media.release_date', value: 'on 2021-10-22' },
      { label: 'media.end_date', value: 'on 2022-01-01', secondary: true },
    ]);
  });

  it.each([
    [45, '45m'],
    [60, '1h 0m'],
    [135, '2h 15m'],
  ])('shows a %i minute runtime as %s', (runtime, expected) => {
    expect(facts({ runtime })[0].value).toBe(expected);
  });

  it.each([
    [999, '$999'],
    [1_500_000, '$1.5M'],
    [2_250_000_000, '$2.3B'],
  ])('shows a %i budget as %s', (budget, expected) => {
    expect(facts({ budget })).toEqual([
      { label: 'media.stat_budget', value: expected, secondary: true },
    ]);
  });

  it('skips a budget or revenue of zero', () => {
    expect(facts({ budget: 0, revenue: 0 })).toEqual([]);
  });

  it('lists seasons, episodes and chapters as plain counts', () => {
    expect(facts({ numberOfSeasons: 3, numberOfEpisodes: 24, chapters: 120 })).toEqual([
      { label: 'media.stat_seasons', value: '3' },
      { label: 'media.stat_episodes', value: '24' },
      { label: 'media.stat_chapters', value: '120' },
    ]);
  });

  it('translates the status and turns a country code into its name', () => {
    expect(facts({ status: 'FINISHED', countryOfOrigin: 'JP' })).toEqual([
      { label: 'media.stat_status', value: 'media.status.finished' },
      { label: 'media.country', value: 'Japan', secondary: true },
    ]);
  });

  it('falls back to a readable AniList format when there is no translation', () => {
    expect(facts({ format: 'TV_SHORT' })).toEqual([
      { label: 'media.format', value: 'Tv short', secondary: true },
    ]);
  });
});

describe('buildHeroMeta', () => {
  const meta = (type: Parameters<typeof buildHeroMeta>[0], overrides: Partial<MediaDetailView>) =>
    buildHeroMeta(type, emptyView(overrides), translate);

  it('starts with the type, then the year and a size that fits the type', () => {
    expect(meta('movie', { releaseYear: 2021, runtime: 155 })).toEqual([
      'collection.media_type_one.movie',
      '2021',
      '2h 35',
    ]);
    expect(meta('movie', { runtime: 45 }).at(-1)).toBe('45 min');
  });

  it('counts seasons, episodes or chapters', () => {
    expect(meta('tv_show', { numberOfSeasons: 3 }).at(-1)).toBe('media.meta.seasons');
    expect(meta('anime', { episodes: 12 }).at(-1)).toBe('media.meta.episodes');
    expect(meta('webtoon', { chapters: 40 }).at(-1)).toBe('media.meta.chapters');
  });

  it('lists the first two platforms of a game', () => {
    expect(meta('game', { platforms: ['PC', 'PS5', 'Switch'] }).at(-1)).toBe('PC, PS5');
  });

  it('skips unknown years and sizes', () => {
    expect(meta('manga', {})).toEqual(['collection.media_type_one.manga']);
  });
});

describe('buildCatalogRating', () => {
  const rating = (
    type: Parameters<typeof buildCatalogRating>[0],
    overrides: Partial<MediaDetailView>,
  ) => buildCatalogRating(type, emptyView(overrides), translate);

  it('has no rating without a score', () => {
    expect(rating('movie', {})).toBeNull();
  });

  it('rounds the score to one decimal and names the catalog', () => {
    expect(rating('movie', { voteAverage: 8.149, voteCount: 12 })).toEqual({
      value: 8.1,
      label: 'media.stat_tmdb',
      votes: 12,
    });
    expect(rating('game', { voteAverage: 7 })?.label).toBe('media.stat_igdb');
    expect(rating('anime', { voteAverage: 7 })).toMatchObject({
      label: 'media.stat_anilist',
      votes: null,
    });
  });
});
