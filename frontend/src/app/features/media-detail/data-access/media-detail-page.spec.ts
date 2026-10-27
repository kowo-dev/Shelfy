import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import type { TmdbService } from '@app/core/services/tmdb/tmdb';
import type { IgdbService } from '@app/core/services/igdb/igdb';
import type { AniListService } from '@app/core/services/anilist/anilist';
import type { CollectionService } from '@app/core/services/collection/collection';

import { createMediaDetailPage, type MediaDetailPageDependencies } from './media-detail-page';

function deps(overrides: Partial<MediaDetailPageDependencies> = {}): MediaDetailPageDependencies {
  return {
    tmdb: { getMovie: vi.fn(), getTvShow: vi.fn() } as unknown as TmdbService,
    igdb: { getGame: vi.fn() } as unknown as IgdbService,
    aniList: { getAnime: vi.fn(), getManga: vi.fn() } as unknown as AniListService,
    collectionService: {
      lookup: vi.fn().mockReturnValue(of(null)),
    } as unknown as CollectionService,
    ...overrides,
  };
}

describe('createMediaDetailPage', () => {
  it('loads a movie and the collection lookup', () => {
    const tmdb = {
      getMovie: vi.fn().mockReturnValue(of({ id: 1, title: 'Movie' })),
      getTvShow: vi.fn(),
    } as unknown as TmdbService;
    const collectionService = {
      lookup: vi.fn().mockReturnValue(of({ id: 'ci-1' })),
    } as unknown as CollectionService;
    const onError = vi.fn();
    const page = createMediaDetailPage(onError, deps({ tmdb, collectionService }));

    page.load('movie', 1);

    expect(tmdb.getMovie).toHaveBeenCalledWith(1);
    expect(page.movie()).toEqual({ id: 1, title: 'Movie' });
    expect(page.loading()).toBe(false);
    expect(collectionService.lookup).toHaveBeenCalledWith('tmdb', 'movie', '1');
    expect(page.collectionItem()).toEqual({ id: 'ci-1' });
  });

  it('loads a tv show', () => {
    const tmdb = {
      getMovie: vi.fn(),
      getTvShow: vi.fn().mockReturnValue(of({ id: 2, name: 'Show' })),
    } as unknown as TmdbService;
    const page = createMediaDetailPage(vi.fn(), deps({ tmdb }));

    page.load('tv_show', 2);

    expect(tmdb.getTvShow).toHaveBeenCalledWith(2);
    expect(page.tvShow()).toEqual({ id: 2, name: 'Show' });
  });

  it('loads a game', () => {
    const igdb = {
      getGame: vi.fn().mockReturnValue(of({ id: 3, name: 'Game' })),
    } as unknown as IgdbService;
    const page = createMediaDetailPage(vi.fn(), deps({ igdb }));

    page.load('game', 3);

    expect(page.game()).toEqual({ id: 3, name: 'Game' });
  });

  it('loads anime via AniListService', () => {
    const aniList = {
      getAnime: vi.fn().mockReturnValue(of({ id: 5 })),
      getManga: vi.fn(),
    } as unknown as AniListService;
    const page = createMediaDetailPage(vi.fn(), deps({ aniList }));

    page.load('anime', 5);

    expect(aniList.getAnime).toHaveBeenCalledWith(5);
    expect(page.animeDetail()).toEqual({ id: 5 });
  });

  it('loads manga and webtoon via the same manga endpoint', () => {
    const aniList = {
      getAnime: vi.fn(),
      getManga: vi.fn().mockReturnValue(of({ id: 6 })),
    } as unknown as AniListService;
    const page = createMediaDetailPage(vi.fn(), deps({ aniList }));

    page.load('manga', 6);
    expect(page.mangaDetail()).toEqual({ id: 6 });

    page.load('webtoon', 6);
    expect(aniList.getManga).toHaveBeenCalledTimes(2);
  });

  it('reports errors and stops loading on failure', () => {
    const tmdb = {
      getMovie: vi.fn().mockReturnValue(throwError(() => new Error('boom'))),
      getTvShow: vi.fn(),
    } as unknown as TmdbService;
    const onError = vi.fn();
    const page = createMediaDetailPage(onError, deps({ tmdb }));

    page.load('movie', 1);

    expect(page.loading()).toBe(false);
    expect(onError).toHaveBeenCalled();
  });

  it('reports collection lookup errors independently of the media load', () => {
    const tmdb = {
      getMovie: vi.fn().mockReturnValue(of({ id: 1, title: 'Movie' })),
      getTvShow: vi.fn(),
    } as unknown as TmdbService;
    const collectionService = {
      lookup: vi.fn().mockReturnValue(throwError(() => new Error('lookup failed'))),
    } as unknown as CollectionService;
    const onError = vi.fn();
    const page = createMediaDetailPage(onError, deps({ tmdb, collectionService }));

    page.load('movie', 1);

    expect(onError).toHaveBeenCalled();
  });

  it('resets all signals to their empty state before loading again', () => {
    const tmdb = {
      getMovie: vi.fn().mockReturnValue(of({ id: 1 })),
      getTvShow: vi.fn(),
    } as unknown as TmdbService;
    const page = createMediaDetailPage(vi.fn(), deps({ tmdb }));

    page.load('movie', 1);
    expect(page.movie()).not.toBeNull();

    const igdb = {
      getGame: vi.fn().mockReturnValue(of({ id: 2 })),
    } as unknown as IgdbService;
    const page2 = createMediaDetailPage(vi.fn(), deps({ tmdb, igdb }));
    page2.load('movie', 1);
    page2.load('game', 2);

    expect(page2.movie()).toBeNull();
    expect(page2.game()).toEqual({ id: 2 });
  });

  it('ignores a slow response from a title the user already left', () => {
    const slowMovie = new Subject<{ id: number }>();
    const tmdb = {
      getMovie: vi
        .fn()
        .mockReturnValueOnce(slowMovie)
        .mockReturnValueOnce(of({ id: 2 })),
      getTvShow: vi.fn(),
    } as unknown as TmdbService;
    const page = createMediaDetailPage(vi.fn(), deps({ tmdb }));

    page.load('movie', 1);
    page.load('movie', 2);
    slowMovie.next({ id: 1 });

    expect(page.movie()).toEqual({ id: 2 });
  });
});
