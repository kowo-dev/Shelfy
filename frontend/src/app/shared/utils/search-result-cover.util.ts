import { inject } from '@angular/core';
import type { SearchResult } from '@app/core/services/search/search.model';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { TmdbService } from '@app/core/services/tmdb/tmdb';

export function injectSearchResultCover(): (item: SearchResult) => string | null {
  const tmdb = inject(TmdbService);
  const igdb = inject(IgdbService);
  return (item) => {
    if (item.posterPath?.startsWith('http')) return item.posterPath;
    if (item.provider === 'tmdb') return tmdb.imageUrl(item.posterPath, 'w342');
    if (item.provider === 'igdb') return igdb.imageUrl(item.posterPath, 't_1080p');
    return item.posterPath;
  };
}
