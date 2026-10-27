import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import type { SearchResult } from '@app/core/services/search/search.model';
import { createBannerPickerState, type BannerPick } from './banner-picker-state';

const result = (
  externalId: string,
  mediaType: SearchResult['mediaType'] = 'movie',
): SearchResult => ({
  provider: mediaType === 'game' ? 'igdb' : mediaType === 'anime' ? 'anilist' : 'tmdb',
  mediaType,
  externalId,
  title: `Title ${externalId}`,
  posterPath: `/p${externalId}.jpg`,
  overview: '',
  releaseYear: null,
  genres: [],
  voteAverage: null,
  voteCount: null,
  status: null,
  isInCollection: false,
});

describe('createBannerPickerState', () => {
  let search: ReturnType<typeof vi.fn>;
  let list: ReturnType<typeof vi.fn>;
  let getMovie: ReturnType<typeof vi.fn>;
  let toast: { error: ReturnType<typeof vi.fn> };
  let confirmed: BannerPick[];

  function setup(scope: 'catalog' | 'shelf' = 'catalog') {
    vi.useFakeTimers();
    search = vi.fn().mockReturnValue(
      of({
        results: [result('1'), result('2')],
        hasMore: true,
        page: 1,
        unavailableProviders: [],
      }),
    );
    list = vi.fn().mockReturnValue(
      of({
        content: [
          { media: { ...result('7'), coverUrl: '/c7.jpg', isAdult: false } },
          { media: { ...result('8', 'movie'), coverUrl: null, isAdult: true } },
          { media: { ...result('9'), mediaType: 'book', coverUrl: null, isAdult: false } },
        ],
      }),
    );
    getMovie = vi
      .fn()
      .mockReturnValue(of({ backdropPath: '/b0.jpg', backdropImagePaths: ['/b0.jpg', '/b1.jpg'] }));
    toast = { error: vi.fn() };
    confirmed = [];
    return createBannerPickerState(
      {
        searchService: { search } as never,
        collectionService: { list } as never,
        tmdb: {
          getMovie,
          getTvShow: vi.fn(),
          imageUrl: (path: string | null) => path && `tmdb:${path}`,
        } as never,
        igdb: { imageUrl: (id: string) => `igdb:${id}`, getGame: vi.fn() } as never,
        aniList: { getAnime: vi.fn(), getManga: vi.fn() } as never,
        toastService: toast as never,
        errorMessage: { fromApiError: () => 'failed' } as never,
      },
      { scope, onConfirm: (pick) => confirmed.push(pick) },
    );
  }

  afterEach(() => vi.useRealTimers());

  const typeAndWait = async (state: ReturnType<typeof setup>, text: string) => {
    state.onQueryChange(text);
    await vi.advanceTimersByTimeAsync(300);
  };

  it('loads the shelf once when opened, leaving out books and adult titles', async () => {
    const state = setup();

    state.openPicker();
    await vi.advanceTimersByTimeAsync(0);
    state.openPicker();
    await vi.advanceTimersByTimeAsync(0);

    expect(state.pickerOpen()).toBe(true);
    expect(list).toHaveBeenCalledTimes(1);
    expect(state.shelfResults().map((c) => c.result.externalId)).toEqual(['7']);
  });

  it('searches the catalog after a pause in typing', async () => {
    const state = setup();

    state.onQueryChange('dune');
    expect(state.loading()).toBe(true);
    expect(search).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);

    expect(search).toHaveBeenCalledWith('dune', 1);
    expect(state.results().map((c) => c.coverUrl)).toEqual(['tmdb:/p1.jpg', 'tmdb:/p2.jpg']);
    expect(state.hasMore()).toBe(true);
    expect(state.loading()).toBe(false);
  });

  it('only runs the last of several quick edits', async () => {
    const state = setup();

    state.onQueryChange('d');
    state.onQueryChange('du');
    await vi.advanceTimersByTimeAsync(300);

    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('du', 1);
  });

  it('clears the results when the query is emptied', async () => {
    const state = setup();
    await typeAndWait(state, 'dune');

    state.onQueryChange('  ');

    expect(state.results()).toEqual([]);
    expect(state.loading()).toBe(false);
  });

  it('appends the next page and stops at the last one', async () => {
    const state = setup();
    await typeAndWait(state, 'dune');
    search.mockReturnValue(
      of({ results: [result('3')], hasMore: false, page: 2, unavailableProviders: ['igdb'] }),
    );

    state.loadMoreResults();
    await vi.advanceTimersByTimeAsync(0);

    expect(search).toHaveBeenLastCalledWith('dune', 2);
    expect(state.results()).toHaveLength(3);
    expect(state.unavailableProviders()).toEqual(['igdb']);
    state.loadMoreResults();
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('reports a failed search without leaving the spinner on', async () => {
    const state = setup();
    search.mockReturnValue(throwError(() => new Error('boom')));

    await typeAndWait(state, 'dune');

    expect(toast.error).toHaveBeenCalledWith('failed');
    expect(state.loading()).toBe(false);
  });

  it('searches the shelf instead of the catalog in shelf scope, without paging', async () => {
    const state = setup('shelf');

    await typeAndWait(state, 'matrix');
    state.loadMoreResults();

    expect(search).not.toHaveBeenCalled();
    expect(list).toHaveBeenCalledWith({ search: 'matrix', size: 36 });
    expect(state.results().map((c) => c.result.externalId)).toEqual(['7']);
  });

  it('shows the backdrops of a chosen title once, with their count', async () => {
    const state = setup();
    await typeAndWait(state, 'dune');
    const [candidate] = state.results();

    state.selectMedia(candidate);
    expect(state.imagesLoading()).toBe(true);
    await vi.advanceTimersByTimeAsync(0);

    expect(state.images().map((image) => image.url)).toEqual(['tmdb:/b0.jpg', 'tmdb:/b1.jpg']);
    expect(state.imagesLoading()).toBe(false);
    expect(Object.values(state.counts())).toEqual([2]);
  });

  it('ignores the images of a title the user already left', async () => {
    const state = setup();
    await typeAndWait(state, 'dune');
    const slow = new Subject<unknown>();
    getMovie.mockReturnValue(slow);

    state.selectMedia(state.results()[0]);
    state.backToSearch();
    slow.next({ backdropPath: '/late.jpg', backdropImagePaths: [] });
    await vi.advanceTimersByTimeAsync(0);

    expect(state.images()).toEqual([]);
    expect(state.selectedMedia()).toBeNull();
  });

  it('goes back to the search when the query is edited while a title is open', async () => {
    const state = setup();
    await typeAndWait(state, 'dune');
    state.selectMedia(state.results()[0]);

    state.onQueryChange('arrakis');

    expect(state.selectedMedia()).toBeNull();
  });

  it('keeps the image position between 0 and 100 and resets it on a new image', async () => {
    const state = setup();

    state.setImagePosition(150);
    expect(state.imagePosition()).toBe(100);
    state.setImagePosition(-5);
    expect(state.imagePosition()).toBe(0);
    state.selectImage({ url: 'u', label: 'Backdrop' });
    expect(state.imagePosition()).toBe(50);
  });

  it('confirms the chosen picture with its source and closes', async () => {
    const state = setup();
    await typeAndWait(state, 'dune');
    state.selectMedia(state.results()[0]);
    await vi.advanceTimersByTimeAsync(0);

    state.confirmImage({ imageUrl: 'tmdb:/b0.jpg', position: 30 } as never);

    expect(confirmed).toHaveLength(1);
    expect(confirmed[0].sourceUrl).toBe('https://www.themoviedb.org/movie/1');
    expect(confirmed[0].media.result.externalId).toBe('1');
    expect(state.pickerOpen()).toBe(false);
  });

  it('does nothing on confirm without a chosen title', () => {
    const state = setup();

    state.confirmImage({ imageUrl: 'x', position: 0 } as never);

    expect(confirmed).toEqual([]);
  });

  it('forgets everything when closed', async () => {
    const state = setup();
    state.openPicker();
    await typeAndWait(state, 'dune');
    state.selectMedia(state.results()[0]);

    state.closePicker();

    expect(state.pickerOpen()).toBe(false);
    expect(state.query()).toBe('');
    expect(state.results()).toEqual([]);
    expect(state.selectedMedia()).toBeNull();
    expect(state.imagePosition()).toBe(50);
  });

  it('counts the pictures of a candidate only once', async () => {
    const state = setup();
    await typeAndWait(state, 'dune');
    const [candidate] = state.results();

    state.requestCount(candidate);
    state.requestCount(candidate);
    await vi.advanceTimersByTimeAsync(0);

    expect(getMovie).toHaveBeenCalledTimes(1);
    expect(Object.values(state.counts())).toEqual([2]);
  });
});
