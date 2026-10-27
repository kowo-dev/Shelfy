import { environment } from '@env';
import type { AddTarget } from '@app/core/services/add-sheet/add-sheet';
import type { SearchResult } from '@app/core/services/search/search.model';

const IGDB_IMAGE_BASE_URL = 'https://images.igdb.com/igdb/image/upload/';

export type SearchPosterSize = 'thumb' | 'card';

export function searchResultKey(result: SearchResult): string {
  return `${result.provider}:${result.mediaType}:${result.externalId}`;
}

export function searchResultPoster(result: SearchResult, size: SearchPosterSize): string | null {
  const path = result.posterPath;
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  if (result.provider === 'tmdb') {
    return `${environment.tmdbImageBaseUrl}${size === 'thumb' ? 'w185' : 'w500'}${path}`;
  }
  if (result.provider === 'igdb') {
    return `${IGDB_IMAGE_BASE_URL}${size === 'thumb' ? 't_cover_small_2x' : 't_cover_big_2x'}/${path}.jpg`;
  }
  return path;
}

export function searchResultAddTarget(result: SearchResult, typeLabel: string): AddTarget {
  return {
    provider: result.provider,
    mediaType: result.mediaType,
    externalId: result.externalId,
    title: result.title,
    coverUrl: searchResultPoster(result, 'card'),
    subtitle: [typeLabel, result.releaseYear].filter(Boolean).join(' · ') || null,
  };
}
