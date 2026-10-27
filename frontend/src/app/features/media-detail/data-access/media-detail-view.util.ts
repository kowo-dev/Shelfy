import { TmdbService } from '@app/core/services/tmdb/tmdb';
import type { CastMember, MovieDetail, TvShowDetail } from '@app/core/services/tmdb/tmdb.model';
import { IgdbService } from '@app/core/services/igdb/igdb';
import type { GameDetail, GameSummary } from '@app/core/services/igdb/igdb.model';
import type {
  AniListCharacter,
  AnimeDetail,
  MangaDetail,
} from '@app/core/services/anilist/anilist.model';
import { normalizeExternalRating } from '@shared/utils/collection-rating.util';

export type DetailMediaType = 'movie' | 'tv_show' | 'game' | 'anime' | 'manga' | 'webtoon';

export const NUMERIC_ID_TYPES = new Set<DetailMediaType>([
  'movie',
  'tv_show',
  'game',
  'anime',
  'manga',
  'webtoon',
]);

export const PROVIDER_BY_MEDIA_TYPE: Record<DetailMediaType, string> = {
  movie: 'tmdb',
  tv_show: 'tmdb',
  game: 'igdb',
  anime: 'anilist',
  manga: 'anilist',
  webtoon: 'anilist',
};

export interface MediaDetailSources {
  movie: MovieDetail | null;
  tvShow: TvShowDetail | null;
  game: GameDetail | null;
  animeDetail: AnimeDetail | null;
  mangaDetail: MangaDetail | null;
}

export interface MediaDetailImageServices {
  tmdb: TmdbService;
  igdb: IgdbService;
}

export interface MediaDetailView {
  title: string | undefined;
  overview: string | undefined;
  genres: string[];
  genreIds: (number | string)[];
  voteAverage: number | undefined;
  voteCount: number | undefined;
  originalTitle: string | null;
  releaseDate: string | null;
  releaseYear: number | null;
  cast: CastMember[];
  developers: string[];
  developerIds: number[];
  publishers: string[];
  publisherIds: number[];
  studios: string[];
  studioRefs: { id: number | string; name: string }[];
  networks: string[];
  networkIds: number[];
  director: string | null;
  directorId: number | null;
  budget: number | null;
  revenue: number | null;
  adultContent: boolean;
  tags: string[];
  tagRefs: string[];
  platforms: string[];
  platformIds: number[];
  themes: string[];
  themeIds: number[];
  gameModes: string[];
  gameModeIds: number[];
  storyline: string | null;
  format: string | null;
  source: string | null;
  season: string | null;
  seasonYear: number | null;
  popularity: number | null;
  volumes: number | null;
  animeCharacters: AniListCharacter[];
  mangaCharacters: AniListCharacter[];
  trailerUrl: string | null;
  status: string | null;
  endDate: string | null;
  episodes: number | null;
  chapters: number | null;
  countryOfOrigin: string | null;
  runtime: number | null;
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  authors: string[];
  authorKeys: string[];
  franchiseName: string | null;
  franchiseId: number | null;
  dlcs: GameSummary[];
  posterUrl: string | null;
  backdropUrl: string | null;
  galleryImages: string[];
}

const EMPTY_VIEW: MediaDetailView = {
  title: undefined,
  overview: undefined,
  genres: [],
  genreIds: [],
  voteAverage: undefined,
  voteCount: undefined,
  originalTitle: null,
  releaseDate: null,
  releaseYear: null,
  cast: [],
  developers: [],
  developerIds: [],
  publishers: [],
  publisherIds: [],
  studios: [],
  studioRefs: [],
  networks: [],
  networkIds: [],
  director: null,
  directorId: null,
  budget: null,
  revenue: null,
  adultContent: false,
  tags: [],
  tagRefs: [],
  platforms: [],
  platformIds: [],
  themes: [],
  themeIds: [],
  gameModes: [],
  gameModeIds: [],
  storyline: null,
  format: null,
  source: null,
  season: null,
  seasonYear: null,
  popularity: null,
  volumes: null,
  animeCharacters: [],
  mangaCharacters: [],
  trailerUrl: null,
  status: null,
  endDate: null,
  episodes: null,
  chapters: null,
  countryOfOrigin: null,
  runtime: null,
  numberOfSeasons: null,
  numberOfEpisodes: null,
  authors: [],
  authorKeys: [],
  franchiseName: null,
  franchiseId: null,
  dlcs: [],
  posterUrl: null,
  backdropUrl: null,
  galleryImages: [],
};

type ViewPart = Partial<MediaDetailView>;

const present = (url: string | null): url is string => url !== null;

function tmdbView(detail: MovieDetail | TvShowDetail, tmdb: TmdbService): ViewPart {
  return {
    overview: detail.overview,
    genres: detail.genres.map((genre) => genre.name),
    genreIds: detail.genres.map((genre) => genre.id),
    voteAverage: detail.voteAverage,
    voteCount: detail.voteCount,
    cast: detail.cast ?? [],
    studios: detail.productionCompanies?.map((company) => company.name) ?? [],
    studioRefs: detail.productionCompanies ?? [],
    adultContent: detail.isAdult ?? false,
    trailerUrl: detail.trailerUrl ?? null,
    posterUrl: tmdb.imageUrl(detail.posterPath ?? null, 'w342'),
    backdropUrl: tmdb.imageUrl(detail.backdropPath ?? null, 'w1280'),
    galleryImages: [...(detail.backdropImagePaths ?? []), ...(detail.posterImagePaths ?? [])]
      .map((path) => tmdb.imageUrl(path, 'w1280'))
      .filter(present),
  };
}

function movieView(movie: MovieDetail, tmdb: TmdbService): ViewPart {
  return {
    ...tmdbView(movie, tmdb),
    title: movie.title,
    originalTitle: movie.originalTitle ?? null,
    releaseDate: movie.releaseDate ?? null,
    director: movie.director?.name ?? null,
    directorId: movie.director?.id ?? null,
    budget: movie.budget ?? null,
    revenue: movie.revenue ?? null,
    runtime: movie.runtime ?? null,
  };
}

function tvShowView(tvShow: TvShowDetail, tmdb: TmdbService): ViewPart {
  return {
    ...tmdbView(tvShow, tmdb),
    title: tvShow.name,
    originalTitle: tvShow.originalName ?? null,
    releaseDate: tvShow.firstAirDate ?? null,
    networks: tvShow.networks?.map((network) => network.name) ?? [],
    networkIds: tvShow.networks?.map((network) => network.id) ?? [],
    numberOfSeasons: tvShow.numberOfSeasons ?? null,
    numberOfEpisodes: tvShow.numberOfEpisodes ?? null,
  };
}

function gameView(game: GameDetail, igdb: IgdbService): ViewPart {
  const image = (id: string | null) => igdb.imageUrl(id, 't_1080p');
  return {
    title: game.name,
    overview: game.summary,
    genres: game.genres?.map((genre) => genre.name) ?? [],
    genreIds: game.genres?.map((genre) => genre.id) ?? [],
    voteAverage: game.rating,
    voteCount: game.ratingCount,
    releaseDate: game.releaseDate ?? null,
    developers: game.developers?.map((company) => company.name) ?? [],
    developerIds: game.developers?.map((company) => company.id) ?? [],
    publishers: game.publishers?.map((company) => company.name) ?? [],
    publisherIds: game.publishers?.map((company) => company.id) ?? [],
    adultContent: game.isAdult ?? false,
    platforms: game.platforms?.map((platform) => platform.name) ?? [],
    platformIds: game.platforms?.map((platform) => platform.id) ?? [],
    themes: game.themes?.map((theme) => theme.name) ?? [],
    themeIds: game.themes?.map((theme) => theme.id) ?? [],
    gameModes: game.gameModes?.map((mode) => mode.name) ?? [],
    gameModeIds: game.gameModes?.map((mode) => mode.id) ?? [],
    storyline: game.storyline || null,
    franchiseName: game.franchiseName ?? null,
    franchiseId: game.franchiseId ?? null,
    dlcs: game.dlcs ?? [],
    posterUrl: image(game.coverImageId ?? null),
    backdropUrl: image(game.screenshotImageIds[0] ?? null),
    galleryImages: [...(game.screenshotImageIds ?? []), ...(game.artworkImageIds ?? [])]
      .map(image)
      .filter(present),
  };
}

function aniListView(detail: AnimeDetail | MangaDetail): ViewPart {
  const credits = detail.creators ?? [];
  const director = credits.find((credit) => credit.role === 'director') ?? null;
  const authors = credits.filter((credit) => credit.role === 'author');
  return {
    title: detail.title,
    overview: detail.summary,
    genres: detail.genres ?? [],
    voteAverage: detail.rating,
    releaseDate: detail.releaseDate ?? null,
    director: director?.name ?? null,
    directorId: director?.id ?? null,
    authors: authors.map((author) => author.name),
    authorKeys: authors.map((author) => String(author.id)),
    tags: detail.tags ?? [],
    tagRefs: detail.tags ?? [],
    format: detail.format ?? null,
    source: detail.source ?? null,
    popularity: detail.popularity ?? null,
    trailerUrl: detail.trailerUrl ?? null,
    status: detail.status ?? null,
    endDate: detail.endDate ?? null,
    countryOfOrigin: detail.countryOfOrigin ?? null,
    posterUrl: detail.coverImageUrl ?? null,
    backdropUrl: detail.bannerImageUrl ?? null,
    galleryImages: [
      ...new Set(
        [detail.bannerImageUrl, detail.coverImageUrl].filter((image): image is string => !!image),
      ),
    ],
  };
}

function animeView(anime: AnimeDetail): ViewPart {
  return {
    ...aniListView(anime),
    studios: anime.studios?.map((studio) => studio.name) ?? [],
    studioRefs: anime.studios ?? [],
    season: anime.season ?? null,
    seasonYear: anime.seasonYear ?? null,
    episodes: anime.episodes ?? null,
    animeCharacters: anime.characters ?? [],
  };
}

function mangaView(manga: MangaDetail): ViewPart {
  return {
    ...aniListView(manga),
    volumes: manga.volumes ?? null,
    chapters: manga.chapters ?? null,
    mangaCharacters: manga.characters ?? [],
  };
}

function sourceView(
  mediaType: DetailMediaType,
  sources: MediaDetailSources,
  { tmdb, igdb }: MediaDetailImageServices,
): ViewPart {
  switch (mediaType) {
    case 'movie':
      return sources.movie ? movieView(sources.movie, tmdb) : {};
    case 'tv_show':
      return sources.tvShow ? tvShowView(sources.tvShow, tmdb) : {};
    case 'game':
      return sources.game ? gameView(sources.game, igdb) : {};
    case 'anime':
      return sources.animeDetail ? animeView(sources.animeDetail) : {};
    case 'manga':
    case 'webtoon':
      return sources.mangaDetail ? mangaView(sources.mangaDetail) : {};
  }
}

export function buildMediaDetailView(
  mediaType: DetailMediaType,
  sources: MediaDetailSources,
  services: MediaDetailImageServices,
): MediaDetailView {
  const view = { ...EMPTY_VIEW, ...sourceView(mediaType, sources, services) };
  const rating = view.voteAverage;
  return {
    ...view,
    voteAverage:
      rating == null ? rating : normalizeExternalRating(PROVIDER_BY_MEDIA_TYPE[mediaType], rating),
    releaseYear: view.releaseDate ? new Date(view.releaseDate).getFullYear() : null,
  };
}
