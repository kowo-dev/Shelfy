import { signal } from '@angular/core';
import {
  catchError,
  EMPTY,
  forkJoin,
  map,
  merge,
  of,
  shareReplay,
  switchMap,
  type Observable,
  type Subscription,
} from 'rxjs';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { DiscoverService } from '@app/core/services/discover/discover';
import type { DiscoverCategory, DiscoverFeed } from '@app/core/services/discover/discover.model';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { todayIsoDate } from '@shared/utils/local-date.util';
import {
  toAnimePreview,
  toGamePreview,
  toMangaPreview,
  toMoviePreview,
  toSeriesPreview,
  toWebtoonPreview,
} from './discover-preview.util';
import { artKey, resolveArt, type HomeArt, type HomeArtResolver } from './home-art';

export type HomeFilter = 'all' | DiscoverCategory;

export const HOME_TYPES: readonly DiscoverCategory[] = [
  'movie',
  'tv_show',
  'game',
  'anime',
  'manga',
  'webtoon',
];

export const HOME_FILTERS: readonly HomeFilter[] = ['all', ...HOME_TYPES];

export function isHomeFilter(value: string | null | undefined): value is HomeFilter {
  return HOME_FILTERS.includes(value as HomeFilter);
}

export interface HomeSlide {
  item: CollectionItemResponse;
  art: HomeArt | null;
}

export interface SoonDay {
  date: string;
  items: CollectionItemResponse[];
}

export interface HomeDiscovery {
  filter: HomeFilter;
  featured: HomeSlide | null;
  stage: HomeSlide[];
  anticipated: HomeSlide[];
  top: CollectionItemResponse[];
  soon: SoonDay[];
  released: CollectionItemResponse[];
  rated: CollectionItemResponse[];
  wall: string[];
  pending: boolean;
}

function emptyView(filter: HomeFilter): HomeDiscovery {
  return {
    filter,
    featured: null,
    stage: [],
    anticipated: [],
    top: [],
    soon: [],
    released: [],
    rated: [],
    wall: [],
    pending: false,
  };
}

const STAGE_SIZE = 5;
const ANTICIPATED_SIZE = 4;
const ART_CANDIDATES = 12;
const TOP_SIZE = 10;
const RELEASED_SIZE = 8;
const RATED_SIZE = 10;
const SOON_DAYS = 9;
const SOON_PER_DAY = 2;
const SOON_WINDOW_DAYS = 60;
const WALL_SIZE = 24;
const DAY_MS = 86_400_000;

const FEED_SIZE: Record<DiscoverFeed, number> = {
  trending: 20,
  top_rated: 20,
  new: 30,
  upcoming: 120,
};

const BACKDROP_TYPES: ReadonlySet<DiscoverCategory> = new Set(['movie', 'tv_show', 'game']);
const UPCOMING_TYPES: ReadonlySet<DiscoverCategory> = new Set([
  'movie',
  'tv_show',
  'game',
  'anime',
]);

export function interleave<T>(lists: readonly (readonly T[])[]): T[] {
  const out: T[] = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let index = 0; index < longest; index++) {
    for (const list of lists) {
      if (index < list.length) out.push(list[index]);
    }
  }
  return out;
}

export function releaseDateOf(item: CollectionItemResponse): string | null {
  const value = item.media.metadata?.['releaseDate'];
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

export function groupSoon(
  items: readonly CollectionItemResponse[],
  today: string,
  excluded: ReadonlySet<string>,
): SoonDay[] {
  const days = new Map<string, CollectionItemResponse[]>();
  const seen = new Set<string>();
  const dated = items
    .map((item, order) => ({ item, order, date: releaseDateOf(item) }))
    .filter(
      (entry): entry is { item: CollectionItemResponse; order: number; date: string } =>
        entry.date !== null &&
        !!entry.item.media.coverUrl &&
        daysBetween(today, entry.date) > 0 &&
        daysBetween(today, entry.date) <= SOON_WINDOW_DAYS,
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
  for (const { item, date } of dated) {
    const key = artKey(item);
    if (excluded.has(key) || seen.has(key)) continue;
    const day = days.get(date) ?? [];
    if (day.length >= SOON_PER_DAY) continue;
    day.push(item);
    days.set(date, day);
    seen.add(key);
  }
  return [...days.entries()].slice(0, SOON_DAYS).map(([date, entries]) => ({
    date,
    items: entries,
  }));
}

export function pickFeatured(
  slides: readonly HomeSlide[],
  random: () => number = Math.random,
): HomeSlide | null {
  const framed = slides.filter((slide) => slide.art !== null);
  const pool = framed.length ? framed : slides;
  return pool[Math.floor(random() * pool.length)] ?? null;
}

export interface FeedServices {
  discover: DiscoverService;
  tmdb: TmdbService;
  igdb: IgdbService;
}

export function loadFeed(
  { discover, tmdb, igdb }: FeedServices,
  cat: DiscoverCategory,
  kind: DiscoverFeed,
  size: number,
): Observable<CollectionItemResponse[]> {
  const items = <T>(
    source: Observable<{ content: T[] }>,
    preview: (value: T) => CollectionItemResponse,
  ) => source.pipe(map((page) => page.content.map(preview)));
  switch (cat) {
    case 'movie':
      return items(discover.getMovies(kind, 0, size), (movie) => toMoviePreview(movie, tmdb));
    case 'tv_show':
      return items(discover.getSeries(kind, 0, size), (show) => toSeriesPreview(show, tmdb));
    case 'game':
      return items(discover.getGames(kind, 0, size), (game) => toGamePreview(game, igdb));
    case 'anime':
      return items(discover.getAnime(kind, 0, size), toAnimePreview);
    case 'manga':
      return items(discover.getManga(kind, 0, size), toMangaPreview);
    case 'webtoon':
      return items(discover.getWebtoons(kind, 0, size), toWebtoonPreview);
  }
}

export interface HomeDiscoveryDependencies {
  discover: DiscoverService;
  tmdb: TmdbService;
  igdb: IgdbService;
  art: HomeArtResolver;
  today?: () => string;
  random?: () => number;
}

export function createHomeDiscovery(deps: HomeDiscoveryDependencies) {
  const { discover, tmdb, igdb, art } = deps;
  const today = deps.today ?? todayIsoDate;
  const random = deps.random ?? Math.random;
  const feeds = new Map<string, Observable<CollectionItemResponse[]>>();
  const views = new Map<HomeFilter, Observable<HomeDiscovery>>();

  const view = signal<HomeDiscovery | null>(null);
  const loading = signal(false);
  let subscription: Subscription | null = null;

  function feed(cat: DiscoverCategory, kind: DiscoverFeed): Observable<CollectionItemResponse[]> {
    const key = `${cat}:${kind}`;
    let cached = feeds.get(key);
    if (!cached) {
      cached = loadFeed({ discover, tmdb, igdb }, cat, kind, FEED_SIZE[kind]).pipe(
        catchError(() => of([])),
        shareReplay(1),
      );
      feeds.set(key, cached);
    }
    return cached;
  }

  function lists(
    types: readonly DiscoverCategory[],
    kind: DiscoverFeed,
  ): Observable<Map<DiscoverCategory, CollectionItemResponse[]>> {
    if (!types.length) return of(new Map());
    return forkJoin(types.map((type) => feed(type, kind))).pipe(
      map((results) => new Map(types.map((type, index) => [type, results[index]]))),
    );
  }

  function withArt(pool: CollectionItemResponse[], size: number): Observable<HomeSlide[]> {
    return resolveArt(art, pool.slice(0, ART_CANDIDATES), size).pipe(
      map((slides) => slides.filter((slide) => slide.art !== null).slice(0, size)),
    );
  }

  function preferArt(pool: CollectionItemResponse[], size: number): Observable<HomeSlide[]> {
    return resolveArt(art, pool.slice(0, ART_CANDIDATES), size).pipe(
      map((slides) => {
        const framed = slides.filter((slide) => slide.art !== null).slice(0, size);
        const covers = slides.filter((slide) => slide.art === null);
        return [...framed, ...covers.slice(0, size - framed.length)];
      }),
    );
  }

  function build(filter: HomeFilter): Observable<HomeDiscovery> {
    const all = filter === 'all';
    const screen: DiscoverCategory[] = ['movie', 'tv_show'];
    const trendTypes: DiscoverCategory[] = all ? ['movie', 'tv_show', 'game', 'anime'] : [filter];
    const stageTypes = all ? screen : [filter];
    const upcomingTypes = trendTypes.filter((type) => UPCOMING_TYPES.has(type));
    const anticipatedTypes: DiscoverCategory[] = all
      ? ['game', 'movie', 'tv_show']
      : BACKDROP_TYPES.has(filter)
        ? [filter]
        : [];
    const releasedTypes = all ? screen : [filter];
    const backdropStage = stageTypes.every((type) => BACKDROP_TYPES.has(type));
    const day = today();
    const pick = (
      source: Map<DiscoverCategory, CollectionItemResponse[]>,
      types: readonly DiscoverCategory[],
    ) => types.map((type) => source.get(type) ?? []);
    const covered = (item: CollectionItemResponse) => !!item.media.coverUrl;

    const stagePool$ = lists(stageTypes, 'trending').pipe(
      map((trending) => interleave(pick(trending, stageTypes)).filter(covered)),
      shareReplay(1),
    );
    const stageSlides$ = stagePool$.pipe(
      switchMap((pool) =>
        backdropStage ? withArt(pool, STAGE_SIZE) : preferArt(pool, STAGE_SIZE),
      ),
      shareReplay(1),
    );
    const featured$ = stageSlides$.pipe(
      map((slides) => pickFeatured(slides, random)),
      shareReplay(1),
    );
    const wall$ = stagePool$.pipe(
      map((pool) =>
        backdropStage
          ? []
          : [...new Set(pool.map((item) => item.media.coverUrl!))].slice(0, WALL_SIZE),
      ),
    );
    const stage$ = forkJoin({ featured: featured$, stage: stageSlides$, wall: wall$ }).pipe(
      map(({ featured, stage, wall }): HomeDiscovery => ({
        ...emptyView(filter),
        featured,
        stage,
        wall,
        pending: true,
      })),
    );

    const full$ = forkJoin({
      trending: lists(trendTypes, 'trending'),
      upcoming: lists(upcomingTypes, 'upcoming'),
      released: lists(releasedTypes, 'new'),
      rated: lists(trendTypes, 'top_rated'),
      featured: featured$,
      stage: stageSlides$,
      wall: wall$,
    }).pipe(
      switchMap(({ trending, upcoming, released, rated, featured, stage, wall }) => {
        const anticipatedPool = interleave(pick(upcoming, anticipatedTypes)).filter((item) => {
          const date = releaseDateOf(item);
          return covered(item) && date !== null && daysBetween(day, date) > 0;
        });
        return withArt(anticipatedPool, ANTICIPATED_SIZE).pipe(
          map((anticipated): HomeDiscovery => {
            const topLists = all
              ? [
                  interleave(pick(trending, screen)),
                  ...pick(trending, ['game', 'anime'] satisfies DiscoverCategory[]),
                ]
              : pick(trending, [filter]);
            const top = interleave(topLists).filter(covered).slice(0, TOP_SIZE);
            const used = new Set<string>(
              [
                ...stage.map((slide) => slide.item),
                ...anticipated.map((slide) => slide.item),
                ...top,
              ].map(artKey),
            );
            const soon = groupSoon(interleave(pick(upcoming, upcomingTypes)), day, used);
            for (const group of soon) for (const item of group.items) used.add(artKey(item));
            const fresh = interleave(pick(released, releasedTypes))
              .map((item) => ({ item, date: releaseDateOf(item) }))
              .filter(
                (entry): entry is { item: CollectionItemResponse; date: string } =>
                  entry.date !== null &&
                  covered(entry.item) &&
                  entry.date <= day &&
                  !used.has(artKey(entry.item)),
              )
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, RELEASED_SIZE)
              .map((entry) => entry.item);
            for (const item of fresh) used.add(artKey(item));
            const best = interleave(pick(rated, trendTypes))
              .filter((item) => covered(item) && item.rating !== null && !used.has(artKey(item)))
              .slice(0, RATED_SIZE)
              .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
            return {
              filter,
              featured,
              stage,
              anticipated,
              top,
              soon,
              released: fresh,
              rated: best,
              wall,
              pending: false,
            };
          }),
        );
      }),
      catchError(() => of(emptyView(filter))),
    );

    return merge(stage$.pipe(catchError(() => EMPTY)), full$);
  }

  function select(filter: HomeFilter): void {
    let source = views.get(filter);
    if (!source) {
      source = build(filter).pipe(shareReplay(1));
      views.set(filter, source);
    }
    subscription?.unsubscribe();
    loading.set(true);
    subscription = source.subscribe((next) => {
      view.set(next);
      loading.set(next.pending);
    });
  }

  function prefetch(filter: HomeFilter): void {
    if (views.has(filter)) return;
    const source = build(filter).pipe(shareReplay(1));
    views.set(filter, source);
    source.subscribe();
  }

  return {
    view: view.asReadonly(),
    loading: loading.asReadonly(),
    select,
    prefetch,
    dispose: () => subscription?.unsubscribe(),
  };
}
