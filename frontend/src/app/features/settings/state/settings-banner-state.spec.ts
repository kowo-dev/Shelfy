import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import type { AniListService } from '@app/core/services/anilist/anilist';
import type { AuthService } from '@app/core/services/auth/auth';
import type { ErrorMessageService } from '@app/core/services/error-message/error-message';
import type { IgdbService } from '@app/core/services/igdb/igdb';
import type { SearchService } from '@app/core/services/search/search';
import type { SearchResult } from '@app/core/services/search/search.model';
import type { ToastService } from '@app/core/services/toast/toast';
import type { TmdbService } from '@app/core/services/tmdb/tmdb';
import type { TranslateService } from '@app/core/services/translate/translate';

import { createSettingsBannerState } from './settings-banner-state';

function searchResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    provider: 'tmdb',
    mediaType: 'movie',
    externalId: '1',
    title: 'Movie',
    posterPath: 'poster.jpg',
    ...overrides,
  } as SearchResult;
}

function makeDeps(overrides: {
  search?: ReturnType<typeof vi.fn>;
  getMovie?: ReturnType<typeof vi.fn>;
  updateProfileBanner?: ReturnType<typeof vi.fn>;
  clearProfileBanner?: ReturnType<typeof vi.fn>;
}) {
  const authService = {
    updateProfileBanner: overrides.updateProfileBanner ?? vi.fn().mockResolvedValue(undefined),
    clearProfileBanner: overrides.clearProfileBanner ?? vi.fn().mockResolvedValue(undefined),
  } as unknown as AuthService;
  const searchService = {
    search:
      overrides.search ??
      vi
        .fn()
        .mockReturnValue(
          of({ results: [searchResult()], hasMore: false, unavailableProviders: [], page: 1 }),
        ),
  } as unknown as SearchService;
  const tmdb = {
    getMovie:
      overrides.getMovie ??
      vi.fn().mockReturnValue(of({ backdropPath: 'bd.jpg', backdropImagePaths: [] })),
    getTvShow: vi.fn(),
    imageUrl: vi.fn((path: string | null) => (path ? `https://tmdb/${path}` : null)),
  } as unknown as TmdbService;
  const igdb = { getGame: vi.fn(), imageUrl: vi.fn() } as unknown as IgdbService;
  const aniList = { getAnime: vi.fn(), getManga: vi.fn() } as unknown as AniListService;
  const toastService = { success: vi.fn(), error: vi.fn() } as unknown as ToastService;
  const errorMessage = {
    fromApiError: vi.fn().mockReturnValue('err'),
  } as unknown as ErrorMessageService;
  const translate = { get: vi.fn((key: string) => key) } as unknown as TranslateService;
  return { authService, searchService, tmdb, igdb, aniList, toastService, errorMessage, translate };
}

describe('createSettingsBannerState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts closed with defaults', () => {
    const deps = makeDeps({});
    const state = createSettingsBannerState(deps);

    expect(state.pickerOpen()).toBe(false);
    expect(state.results()).toEqual([]);
    expect(state.imagePosition()).toBe(50);
    expect(state.pendingBanner()).toBeUndefined();
  });

  it('openPicker() opens the dialog', () => {
    const deps = makeDeps({});
    const state = createSettingsBannerState(deps);

    state.openPicker();

    expect(state.pickerOpen()).toBe(true);
  });

  it('onQueryChange() debounces and populates results', async () => {
    const deps = makeDeps({});
    const state = createSettingsBannerState(deps);

    state.onQueryChange('matrix');
    expect(state.loading()).toBe(true);
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve();

    expect(deps.searchService.search).toHaveBeenCalledWith('matrix', 1);
    expect(state.results()).toHaveLength(1);
    expect(state.loading()).toBe(false);
  });

  it('onQueryChange() with an empty query clears results without searching', () => {
    const deps = makeDeps({});
    const state = createSettingsBannerState(deps);

    state.onQueryChange('   ');

    expect(state.loading()).toBe(false);
    expect(deps.searchService.search).not.toHaveBeenCalled();
  });

  it('onQueryChange() leaves the image step and returns to the search home', () => {
    const state = createSettingsBannerState(makeDeps({}));
    state.selectMedia({ result: searchResult(), coverUrl: null });

    state.onQueryChange('zelda');

    expect(state.selectedMedia()).toBeNull();
    expect(state.selectedImage()).toBeNull();
    expect(state.query()).toBe('zelda');
  });

  it('loadMoreResults() appends results from the next page', async () => {
    const deps = makeDeps({
      search: vi
        .fn()
        .mockReturnValueOnce(
          of({
            results: [searchResult({ externalId: '1' })],
            hasMore: true,
            unavailableProviders: [],
            page: 1,
          }),
        )
        .mockReturnValueOnce(
          of({
            results: [searchResult({ externalId: '2' })],
            hasMore: false,
            unavailableProviders: [],
            page: 2,
          }),
        ),
    });
    const state = createSettingsBannerState(deps);
    state.onQueryChange('matrix');
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve();

    state.loadMoreResults();
    await Promise.resolve();

    expect(state.results()).toHaveLength(2);
    expect(state.hasMore()).toBe(false);
  });

  it('selectMedia() loads images for the media and selectImage()/setImagePosition() update state', async () => {
    const deps = makeDeps({});
    const state = createSettingsBannerState(deps);
    const candidate = { result: searchResult(), coverUrl: null };

    state.selectMedia(candidate);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(state.selectedMedia()).toEqual(candidate);
    expect(state.images().length).toBeGreaterThan(0);

    state.selectImage(state.images()[0]);
    expect(state.selectedImage()).toEqual(state.images()[0]);
    expect(state.imagePosition()).toBe(50);

    state.setImagePosition(150);
    expect(state.imagePosition()).toBe(100);
    state.setImagePosition(-10);
    expect(state.imagePosition()).toBe(0);
  });

  it('backToSearch() resets selection state', async () => {
    const deps = makeDeps({});
    const state = createSettingsBannerState(deps);
    const candidate = { result: searchResult(), coverUrl: null };
    state.selectMedia(candidate);
    await Promise.resolve();
    state.selectImage(state.images()[0]);

    state.backToSearch();
    expect(state.selectedMedia()).toBeNull();
    expect(state.images()).toEqual([]);
  });

  it('confirmImage() sets pendingBanner and closes the picker', async () => {
    const deps = makeDeps({});
    const state = createSettingsBannerState(deps);
    const candidate = { result: searchResult(), coverUrl: null };
    state.openPicker();
    state.selectMedia(candidate);
    await Promise.resolve();

    state.confirmImage({ url: 'https://img/banner.jpg', position: 40 });

    expect(state.pendingBanner()).toEqual(
      expect.objectContaining({
        bannerUrl: 'https://img/banner.jpg',
        position: 40,
        title: 'Movie',
      }),
    );
    expect(state.pickerOpen()).toBe(false);
  });

  it('clearBanner() sets pendingBanner to null', () => {
    const deps = makeDeps({});
    const state = createSettingsBannerState(deps);

    state.clearBanner();

    expect(state.pendingBanner()).toBeNull();
  });

  it('save() does nothing when there is no pending banner change', async () => {
    const deps = makeDeps({});
    const state = createSettingsBannerState(deps);

    await state.save();

    expect(deps.authService.updateProfileBanner).not.toHaveBeenCalled();
    expect(deps.authService.clearProfileBanner).not.toHaveBeenCalled();
  });

  it('save() updates the banner when pendingBanner is set', async () => {
    const deps = makeDeps({});
    const state = createSettingsBannerState(deps);
    const candidate = { result: searchResult(), coverUrl: null };
    state.selectMedia(candidate);
    await Promise.resolve();
    state.confirmImage({ url: 'https://img/banner.jpg', position: 40 });

    await state.save();

    expect(deps.authService.updateProfileBanner).toHaveBeenCalled();
    expect(deps.toastService.success).not.toHaveBeenCalled();
    expect(state.pendingBanner()).toBeUndefined();
  });

  it('discard() drops a pending banner change', () => {
    const state = createSettingsBannerState(makeDeps({}));
    state.clearBanner();
    expect(state.pendingBanner()).toBeNull();

    state.discard();

    expect(state.pendingBanner()).toBeUndefined();
  });

  it('save() clears the banner when pendingBanner is null', async () => {
    const deps = makeDeps({});
    const state = createSettingsBannerState(deps);
    state.clearBanner();

    await state.save();

    expect(deps.authService.clearProfileBanner).toHaveBeenCalled();
    expect(deps.toastService.success).not.toHaveBeenCalled();
  });

  it('save() shows a toast error on failure', async () => {
    const deps = makeDeps({ clearProfileBanner: vi.fn().mockRejectedValue(new Error('boom')) });
    const state = createSettingsBannerState(deps);
    state.clearBanner();

    await state.save();

    expect(deps.toastService.error).toHaveBeenCalled();
  });

  it('search() shows a toast error when the request fails', async () => {
    const deps = makeDeps({ search: vi.fn().mockReturnValue(throwError(() => new Error('boom'))) });
    const state = createSettingsBannerState(deps);

    state.onQueryChange('matrix');
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve();

    expect(deps.toastService.error).toHaveBeenCalled();
    expect(state.loading()).toBe(false);
  });

  it('closePicker() resets search and selection state', async () => {
    const deps = makeDeps({});
    const state = createSettingsBannerState(deps);
    state.openPicker();
    state.onQueryChange('matrix');
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve();

    state.closePicker();

    expect(state.pickerOpen()).toBe(false);
    expect(state.query()).toBe('');
    expect(state.results()).toEqual([]);
  });
});
