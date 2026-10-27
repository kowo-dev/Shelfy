import type { TmdbService } from '@app/core/services/tmdb/tmdb';
import type { MovieDetail, TvShowDetail } from '@app/core/services/tmdb/tmdb.model';
import type { IgdbService } from '@app/core/services/igdb/igdb';
import type { GameDetail } from '@app/core/services/igdb/igdb.model';
import type { AnimeDetail, MangaDetail } from '@app/core/services/anilist/anilist.model';

import { buildMediaDetailView, type MediaDetailSources } from './media-detail-view.util';

const EMPTY_SOURCES: MediaDetailSources = {
  movie: null,
  tvShow: null,
  game: null,
  animeDetail: null,
  mangaDetail: null,
};

const tmdb = {
  imageUrl: (path: string | null, size: string) => (path ? `tmdb:${size}:${path}` : null),
} as unknown as TmdbService;

const igdb = {
  imageUrl: (id: string | null, size: string) => (id ? `igdb:${size}:${id}` : null),
} as unknown as IgdbService;

const services = { tmdb, igdb };

describe('buildMediaDetailView', () => {
  it('maps a movie', () => {
    const movie: Partial<MovieDetail> = {
      title: 'Dune',
      overview: 'A boy on a desert planet',
      genres: [{ id: 1, name: 'Sci-Fi' }],
      voteAverage: 8.1,
      voteCount: 5000,
      originalTitle: 'Dune',
      releaseDate: '2021-10-22',
      cast: [{ name: 'T. Chalamet' } as never],
      productionCompanies: [{ id: 10, name: 'Legendary', logoPath: null }],
      director: { id: 1, name: 'D. Villeneuve' },
      budget: 165_000_000,
      revenue: 400_000_000,
      isAdult: false,
      posterPath: '/poster.jpg',
      backdropPath: '/backdrop.jpg',
      backdropImagePaths: ['/b1.jpg'],
      posterImagePaths: ['/p1.jpg'],
    };
    const view = buildMediaDetailView(
      'movie',
      { ...EMPTY_SOURCES, movie: movie as MovieDetail },
      services,
    );

    expect(view.title).toBe('Dune');
    expect(view.overview).toBe('A boy on a desert planet');
    expect(view.genres).toEqual(['Sci-Fi']);
    expect(view.genreIds).toEqual([1]);
    expect(view.voteAverage).toBe(8.1);
    expect(view.voteCount).toBe(5000);
    expect(view.originalTitle).toBe('Dune');
    expect(view.releaseDate).toBe('2021-10-22');
    expect(view.releaseYear).toBe(2021);
    expect(view.cast).toEqual([{ name: 'T. Chalamet' }]);
    expect(view.studios).toEqual(['Legendary']);
    expect(view.director).toBe('D. Villeneuve');
    expect(view.directorId).toBe(1);
    expect(view.budget).toBe(165_000_000);
    expect(view.revenue).toBe(400_000_000);
    expect(view.posterUrl).toBe('tmdb:w342:/poster.jpg');
    expect(view.backdropUrl).toBe('tmdb:w1280:/backdrop.jpg');
    expect(view.galleryImages).toEqual(['tmdb:w1280:/b1.jpg', 'tmdb:w1280:/p1.jpg']);
    expect(view.developers).toEqual([]);
    expect(view.authors).toEqual([]);
    expect(view.season).toBeNull();
  });

  it('maps a tv show', () => {
    const tvShow: Partial<TvShowDetail> = {
      name: 'Severance',
      overview: 'Work-life balance, literally',
      genres: [{ id: 2, name: 'Drama' }],
      voteAverage: 8.7,
      voteCount: 3000,
      originalName: 'Severance',
      firstAirDate: '2022-02-18',
      cast: [{ name: 'A. Scott' } as never],
      productionCompanies: [{ id: 20, name: 'Endeavor', logoPath: null }],
      networks: [{ id: 30, name: 'Apple TV+', logoPath: null }],
      numberOfSeasons: 2,
      numberOfEpisodes: 19,
      posterPath: '/sev-poster.jpg',
      backdropPath: '/sev-backdrop.jpg',
    };
    const view = buildMediaDetailView(
      'tv_show',
      { ...EMPTY_SOURCES, tvShow: tvShow as TvShowDetail },
      services,
    );

    expect(view.title).toBe('Severance');
    expect(view.originalTitle).toBe('Severance');
    expect(view.releaseDate).toBe('2022-02-18');
    expect(view.releaseYear).toBe(2022);
    expect(view.networks).toEqual(['Apple TV+']);
    expect(view.studios).toEqual(['Endeavor']);
    expect(view.posterUrl).toBe('tmdb:w342:/sev-poster.jpg');
    expect(view.director).toBeNull();
    expect(view.budget).toBeNull();
  });

  it('maps a game, normalizing an IGDB 0-100 rating down to 0-10', () => {
    const game: Partial<GameDetail> = {
      name: 'Hades',
      summary: 'Escape the underworld',
      genres: [{ id: 3, name: 'Roguelike' }],
      rating: 92,
      ratingCount: 900,
      releaseDate: '2020-09-17',
      developers: [{ id: 40, name: 'Supergiant' }],
      publishers: [{ id: 41, name: 'Supergiant' }],
      platforms: [{ id: 50, name: 'PC' }],
      themes: [{ id: 60, name: 'Action' }],
      gameModes: [{ id: 70, name: 'Singleplayer' }],
      storyline: 'Escape the underworld, again and again',
      coverImageId: 'cover123',
      screenshotImageIds: ['shot1', 'shot2'],
      artworkImageIds: ['art1'],
      franchiseName: 'Hades',
      franchiseId: 99,
      dlcs: [{ id: 1 } as never],
    };
    const view = buildMediaDetailView(
      'game',
      { ...EMPTY_SOURCES, game: game as GameDetail },
      services,
    );

    expect(view.title).toBe('Hades');
    expect(view.voteAverage).toBeCloseTo(9.2);
    expect(view.developers).toEqual(['Supergiant']);
    expect(view.publishers).toEqual(['Supergiant']);
    expect(view.platforms).toEqual(['PC']);
    expect(view.themes).toEqual(['Action']);
    expect(view.gameModes).toEqual(['Singleplayer']);
    expect(view.storyline).toBe('Escape the underworld, again and again');
    expect(view.posterUrl).toBe('igdb:t_1080p:cover123');
    expect(view.backdropUrl).toBe('igdb:t_1080p:shot1');
    expect(view.galleryImages).toEqual([
      'igdb:t_1080p:shot1',
      'igdb:t_1080p:shot2',
      'igdb:t_1080p:art1',
    ]);
    expect(view.franchiseName).toBe('Hades');
    expect(view.dlcs.length).toBe(1);
  });

  it('maps anime, keeping a sub-10 AniList rating unchanged', () => {
    const animeDetail: Partial<AnimeDetail> = {
      title: 'Frieren',
      summary: 'A long walk after the end',
      genres: ['Fantasy'],
      rating: 9,
      releaseDate: '2023-09-29',
      studios: [{ id: 80, name: 'Madhouse' }],
      tags: ['Isekai'],
      season: 'FALL',
      seasonYear: 2023,
      popularity: 100_000,
      characters: [{ name: 'Frieren' } as never],
      trailerUrl: 'https://youtu.be/x',
      coverImageUrl: 'https://img/cover.jpg',
      bannerImageUrl: 'https://img/banner.jpg',
    };
    const view = buildMediaDetailView(
      'anime',
      { ...EMPTY_SOURCES, animeDetail: animeDetail as AnimeDetail },
      services,
    );

    expect(view.title).toBe('Frieren');
    expect(view.voteAverage).toBe(9);
    expect(view.studios).toEqual(['Madhouse']);
    expect(view.season).toBe('FALL');
    expect(view.seasonYear).toBe(2023);
    expect(view.animeCharacters).toEqual([{ name: 'Frieren' }]);
    expect(view.trailerUrl).toBe('https://youtu.be/x');
    expect(view.posterUrl).toBe('https://img/cover.jpg');
    expect(view.backdropUrl).toBe('https://img/banner.jpg');
  });

  it('maps manga/webtoon, normalizing a >10 AniList rating', () => {
    const mangaDetail: Partial<MangaDetail> = {
      title: 'Chainsaw Man',
      summary: 'Devils and dogs',
      genres: ['Action'],
      rating: 85,
      releaseDate: '2018-12-03',
      tags: ['Gore'],
      volumes: 12,
      characters: [{ name: 'Denji' } as never],
      coverImageUrl: 'https://img/csm-cover.jpg',
    };
    const view = buildMediaDetailView(
      'manga',
      { ...EMPTY_SOURCES, mangaDetail: mangaDetail as MangaDetail },
      services,
    );

    expect(view.title).toBe('Chainsaw Man');
    expect(view.voteAverage).toBeCloseTo(8.5);
    expect(view.volumes).toBe(12);
    expect(view.mangaCharacters).toEqual([{ name: 'Denji' }]);
    expect(view.posterUrl).toBe('https://img/csm-cover.jpg');
  });

  it('returns safe defaults when the source for the given media type is null', () => {
    const view = buildMediaDetailView('movie', EMPTY_SOURCES, services);

    expect(view.title).toBeUndefined();
    expect(view.genres).toEqual([]);
    expect(view.cast).toEqual([]);
    expect(view.posterUrl).toBeNull();
    expect(view.releaseYear).toBeNull();
  });
});
