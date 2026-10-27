import { catchError, forkJoin, from, map, of, shareReplay, switchMap, type Observable } from 'rxjs';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { TmdbService } from '@app/core/services/tmdb/tmdb';

export interface HomeArt {
  full: string;
  wide: string;
  card: string;
  thumb: string;
}

export type HomeArtResolver = (item: CollectionItemResponse) => Observable<HomeArt | null>;

export const VISUALS_KEY = 'visualIds';
export const MAX_BRIGHTNESS = 0.55;
const CANDIDATES = 3;

export function artKey(item: CollectionItemResponse): string {
  return `${item.media.provider}:${item.media.mediaType}:${item.media.externalId}`;
}

export interface ResolvedArt {
  item: CollectionItemResponse;
  art: HomeArt | null;
}

export function resolveArt(
  resolve: HomeArtResolver,
  candidates: readonly CollectionItemResponse[],
  wanted: number,
  batch = wanted,
): Observable<ResolvedArt[]> {
  const step = (offset: number, done: ResolvedArt[]): Observable<ResolvedArt[]> => {
    const next = candidates.slice(offset, offset + Math.max(1, batch));
    if (!next.length || done.filter((entry) => entry.art !== null).length >= wanted) {
      return of(done);
    }
    return forkJoin(next.map((item) => resolve(item))).pipe(
      switchMap((arts) =>
        step(offset + next.length, [
          ...done,
          ...next.map((item, index) => ({ item, art: arts[index] })),
        ]),
      ),
    );
  };
  return step(0, []);
}

export interface HomeArtDependencies {
  tmdb: TmdbService;
  igdb: IgdbService;
  brightness: (url: string) => Promise<number | null>;
}

export function createHomeArt({ tmdb, igdb, brightness }: HomeArtDependencies): HomeArtResolver {
  const cache = new Map<string, Observable<HomeArt | null>>();

  const fromTmdb = (path: string): HomeArt => ({
    full: tmdb.imageUrl(path, 'original')!,
    wide: tmdb.imageUrl(path, 'w1280')!,
    card: tmdb.imageUrl(path, 'w780')!,
    thumb: tmdb.imageUrl(path, 'w300')!,
  });

  const fromIgdb = (artwork: string): HomeArt => ({
    full: igdb.imageUrl(artwork, 't_1080p')!,
    wide: igdb.imageUrl(artwork, 't_1080p')!,
    card: igdb.imageUrl(artwork, 't_screenshot_big')!,
    thumb: igdb.imageUrl(artwork, 't_screenshot_med')!,
  });

  function firstDark(arts: HomeArt[]): Observable<HomeArt | null> {
    const options = arts.slice(0, CANDIDATES);
    if (!options.length) return of(null);
    return forkJoin(options.map((art) => from(brightness(art.thumb).catch(() => null)))).pipe(
      map((levels) => options.find((_, index) => (levels[index] ?? 1) <= MAX_BRIGHTNESS) ?? null),
    );
  }

  function load(item: CollectionItemResponse): Observable<HomeArt | null> {
    const { provider, mediaType, externalId } = item.media;
    const id = Number(externalId);
    if (!Number.isFinite(id)) return of(null);
    if (provider === 'tmdb' && (mediaType === 'movie' || mediaType === 'tv_show')) {
      const detail: Observable<{ backdropImagePaths?: string[] }> =
        mediaType === 'movie' ? tmdb.getMovie(id) : tmdb.getTvShow(id);
      return detail.pipe(
        switchMap((value) => firstDark((value.backdropImagePaths ?? []).map(fromTmdb))),
        catchError(() => of(null)),
      );
    }
    if (provider === 'anilist') {
      const banner = item.media.metadata?.['backdropUrl'];
      return typeof banner === 'string' && banner && banner !== item.media.coverUrl
        ? of({ full: banner, wide: banner, card: banner, thumb: banner })
        : of(null);
    }
    if (provider !== 'igdb') return of(null);
    const known = item.media.metadata?.[VISUALS_KEY];
    const visuals: Observable<string[]> =
      Array.isArray(known) && known.length
        ? of(known.filter((value): value is string => typeof value === 'string'))
        : igdb
            .getGame(id)
            .pipe(
              map((game) => [...(game.screenshotImageIds ?? []), ...(game.artworkImageIds ?? [])]),
            );
    return visuals.pipe(
      map((ids) => (ids.length ? fromIgdb(ids[0]) : null)),
      catchError(() => of(null)),
    );
  }

  return (item) => {
    const key = artKey(item);
    let art = cache.get(key);
    if (!art) {
      art = load(item).pipe(shareReplay(1));
      cache.set(key, art);
    }
    return art;
  };
}
