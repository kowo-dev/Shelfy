import { signal } from '@angular/core';
import type { Params } from '@angular/router';
import {
  catchError,
  map,
  of,
  shareReplay,
  switchMap,
  type Observable,
  type Subscription,
} from 'rxjs';
import type {
  CollectionItemResponse,
  MediaType,
} from '@app/core/services/collection/collection.model';
import {
  EMPTY_EXPLORE_QUERY,
  toRouteParams,
  type ExploreQuery,
} from '@app/core/services/search/explore-query';
import { SearchService } from '@app/core/services/search/search';
import type { SearchResult } from '@app/core/services/search/search.model';
import { searchResultPoster } from '@shared/utils/search-result-media.util';
import { buildPreviewItem } from './discover-preview.util';
import { resolveArt, type HomeArt, type HomeArtResolver } from './home-art';
import type { HomeFilter } from './home-discovery';

const SCREEN_GENRES = [
  'science-fiction',
  'thriller',
  'adventure',
  'comedy',
  'fantasy',
  'mystery',
  'horror',
  'action',
  'romance',
  'drama',
  'crime',
  'war',
];

export const MOOD_GENRES: Record<HomeFilter, readonly string[]> = {
  all: SCREEN_GENRES,
  movie: SCREEN_GENRES,
  tv_show: [
    'crime',
    'mystery',
    'comedy',
    'drama',
    'science-fiction',
    'thriller',
    'fantasy',
    'war',
    'history',
  ],
  game: ['fantasy', 'adventure', 'science-fiction', 'horror', 'action', 'mystery', 'sports'],
  anime: [
    'fantasy',
    'romance',
    'science-fiction',
    'slice-of-life',
    'mecha',
    'sports',
    'mystery',
    'psychological',
    'supernatural',
    'comedy',
  ],
  manga: [
    'romance',
    'fantasy',
    'slice-of-life',
    'mystery',
    'psychological',
    'sports',
    'horror',
    'comedy',
  ],
  webtoon: ['romance', 'fantasy', 'action', 'drama', 'comedy', 'supernatural'],
};

const ROW_SIZE = 5;
const WALL_SIZE = 24;
const HERO_CANDIDATES = 6;
const MOOD_ART_BATCH = 3;
const WEEK_MS = 7 * 86_400_000;
const MONDAY_EPOCH = Date.UTC(1970, 0, 5);

export interface HomeMood {
  filter: HomeFilter;
  genre: string;
  hero: CollectionItemResponse | null;
  art: HomeArt | null;
  items: CollectionItemResponse[];
  wall: string[];
  more: Params;
}

export function weekIndex(date: Date): number {
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((day - MONDAY_EPOCH) / WEEK_MS);
}

export function moodGenre(filter: HomeFilter, date: Date): string | null {
  const genres = MOOD_GENRES[filter];
  return genres.length ? genres[weekIndex(date) % genres.length] : null;
}

function preview(result: SearchResult): CollectionItemResponse {
  return buildPreviewItem(
    result.mediaType,
    result.externalId,
    result.title,
    searchResultPoster(result, 'card'),
    result.voteAverage,
    result.releaseYear === null ? null : `${result.releaseYear}-01-01`,
    { overview: result.overview },
  );
}

export interface HomeMoodDependencies {
  search: SearchService;
  art: HomeArtResolver;
  region: () => string;
  now?: () => Date;
}

export function createHomeMood(deps: HomeMoodDependencies) {
  const now = deps.now ?? (() => new Date());
  const cache = new Map<HomeFilter, Observable<HomeMood | null>>();
  const mood = signal<{ filter: HomeFilter; mood: HomeMood | null } | null>(null);
  let subscription: Subscription | null = null;

  function build(filter: HomeFilter): Observable<HomeMood | null> {
    const genre = moodGenre(filter, now());
    if (!genre) return of(null);
    const type: MediaType = filter === 'all' ? 'movie' : filter;
    const query: ExploreQuery = {
      ...EMPTY_EXPLORE_QUERY,
      type,
      with: [{ token: genre, label: null }],
    };
    return deps.search.explore(query, 1, deps.region()).pipe(
      map((response) => response.results.map(preview).filter((item) => !!item.media.coverUrl)),
      switchMap((items) => {
        if (items.length < ROW_SIZE) return of(null);
        const candidates = items.slice(0, HERO_CANDIDATES);
        return resolveArt(deps.art, candidates, 1, MOOD_ART_BATCH).pipe(
          map((resolved) => {
            const framed = resolved.find((entry) => entry.art !== null) ?? null;
            const hero = framed?.item ?? null;
            const rest = items.filter((item) => item !== hero);
            const wall = Array.from(
              { length: WALL_SIZE },
              (_, position) => items[position % items.length].media.coverUrl!,
            );
            return {
              filter,
              genre,
              hero,
              art: framed?.art ?? null,
              items: rest.slice(0, ROW_SIZE),
              wall,
              more: toRouteParams(query),
            } satisfies HomeMood;
          }),
        );
      }),
      catchError(() => of(null)),
    );
  }

  function select(filter: HomeFilter): void {
    let source = cache.get(filter);
    if (!source) {
      source = build(filter).pipe(shareReplay(1));
      cache.set(filter, source);
    }
    subscription?.unsubscribe();
    subscription = source.subscribe((next) => mood.set({ filter, mood: next }));
  }

  return {
    mood: mood.asReadonly(),
    select,
    dispose: () => subscription?.unsubscribe(),
  };
}
