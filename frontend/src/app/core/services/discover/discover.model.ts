import type {
  AddToCollectionRequest,
  MediaType,
  ShelfMediaType,
} from '@app/core/services/collection/collection.model';

export type DiscoverCategory = ShelfMediaType;

export type DiscoverFeed = 'trending' | 'top_rated' | 'new' | 'upcoming';

export const PROVIDER_BY_CATEGORY: Record<MediaType, AddToCollectionRequest['provider']> = {
  movie: 'tmdb',
  tv_show: 'tmdb',
  game: 'igdb',
  anime: 'anilist',
  manga: 'anilist',
  webtoon: 'anilist',
  book: 'openlibrary',
};

export const PROVIDER_LABEL: Record<string, string> = {
  tmdb: 'TMDB',
  igdb: 'IGDB',
  anilist: 'AniList',
};
