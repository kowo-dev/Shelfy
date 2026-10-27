import type { GameSummary } from '@app/core/services/igdb/igdb.model';
import { IgdbService } from '@app/core/services/igdb/igdb';
import type { MovieSummary, TvShowSummary } from '@app/core/services/tmdb/tmdb.model';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import type { AnimeSummary, MangaSummary } from '@app/core/services/anilist/anilist.model';
import type {
  CollectionItemResponse,
  MediaType,
} from '@app/core/services/collection/collection.model';
import { PROVIDER_BY_CATEGORY } from '@app/core/services/discover/discover.model';
import { normalizeExternalRating } from '@shared/utils/collection-rating.util';
import { VISUALS_KEY } from './home-art';

export function buildPreviewItem(
  category: MediaType,
  externalId: number | string,
  title: string,
  coverUrl: string | null,
  rating: number | null | undefined,
  releaseDate: string | null | undefined,
  extraMetadata: Record<string, unknown>,
): CollectionItemResponse {
  const id = `${category}-${externalId}`;
  const provider = PROVIDER_BY_CATEGORY[category];
  const normalizedRating =
    rating != null && !isNaN(rating)
      ? Math.round(normalizeExternalRating(provider, rating) * 10) / 10
      : null;
  return {
    id,
    userId: '',
    media: {
      id,
      canonicalWorkId: id,
      externalId: String(externalId),
      provider,
      mediaType: category,
      title,
      coverUrl,
      metadata: { ...(releaseDate ? { releaseDate } : {}), ...extraMetadata },
      createdAt: '',
    },
    status: 'planned',
    rating: normalizedRating,
    note: null,
    containsSpoilers: false,
    progress: {},
    createdAt: '',
    updatedAt: '',
  };
}

export function toMoviePreview(movie: MovieSummary, tmdb: TmdbService): CollectionItemResponse {
  return buildPreviewItem(
    'movie',
    movie.id,
    movie.title,
    tmdb.imageUrl(movie.posterPath, 'w500'),
    movie.voteAverage,
    movie.releaseDate,
    {
      overview: movie.overview,
      genreIds: movie.genreIds,
      backdropUrl: tmdb.imageUrl(movie.backdropPath, 'w1280'),
    },
  );
}

export function toSeriesPreview(show: TvShowSummary, tmdb: TmdbService): CollectionItemResponse {
  return buildPreviewItem(
    'tv_show',
    show.id,
    show.name,
    tmdb.imageUrl(show.posterPath, 'w500'),
    show.voteAverage,
    show.firstAirDate,
    {
      overview: show.overview,
      genreIds: show.genreIds,
      backdropUrl: tmdb.imageUrl(show.backdropPath, 'w1280'),
    },
  );
}

export function toGamePreview(game: GameSummary, igdb: IgdbService): CollectionItemResponse {
  const visuals = [...(game.screenshotImageIds ?? []), ...(game.artworkImageIds ?? [])];
  const backdropId = visuals[0] ?? game.coverImageId;
  return buildPreviewItem(
    'game',
    game.id,
    game.name,
    igdb.imageUrl(game.coverImageId, 't_1080p'),
    game.rating,
    game.releaseDate,
    {
      overview: game.summary,
      genres: game.genres,
      backdropUrl: backdropId ? igdb.imageUrl(backdropId, 't_1080p') : null,
      ...(visuals.length ? { [VISUALS_KEY]: visuals.slice(0, 3) } : {}),
    },
  );
}

export function toAnimePreview(anime: AnimeSummary): CollectionItemResponse {
  return buildPreviewItem(
    'anime',
    anime.id,
    anime.title,
    anime.coverImageUrl,
    anime.rating,
    anime.releaseDate,
    {
      overview: anime.summary,
      genres: anime.genres,
      backdropUrl: anime.bannerImageUrl ?? anime.coverImageUrl,
    },
  );
}

export function toMangaPreview(manga: MangaSummary): CollectionItemResponse {
  return buildPreviewItem(
    'manga',
    manga.id,
    manga.title,
    manga.coverImageUrl,
    manga.rating,
    manga.releaseDate,
    {
      overview: manga.summary,
      genres: manga.genres,
      backdropUrl: manga.bannerImageUrl ?? manga.coverImageUrl,
    },
  );
}

export function toWebtoonPreview(webtoon: MangaSummary): CollectionItemResponse {
  return buildPreviewItem(
    'webtoon',
    webtoon.id,
    webtoon.title,
    webtoon.coverImageUrl,
    webtoon.rating,
    webtoon.releaseDate,
    {
      overview: webtoon.summary,
      genres: webtoon.genres,
      backdropUrl: webtoon.bannerImageUrl ?? webtoon.coverImageUrl,
    },
  );
}
