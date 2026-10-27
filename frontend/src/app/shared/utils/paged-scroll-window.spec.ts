import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import type { PagedResponse } from '@app/core/services/collection/collection.model';

import { createPagedScrollWindow } from './paged-scroll-window';

function page(content: number[], totalElements: number): PagedResponse<number> {
  return { content, page: 0, size: content.length, totalElements };
}

function scrollEl(overrides: Partial<HTMLElement> = {}): HTMLElement {
  return {
    scrollHeight: 1000,
    clientHeight: 500,
    scrollTop: 500,
    ...overrides,
  } as HTMLElement;
}

describe('createPagedScrollWindow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts empty', () => {
    const state = createPagedScrollWindow({
      pageSize: 10,
      fetchPage: vi.fn(),
      scrollContainer: () => null,
    });

    expect(state.items()).toEqual([]);
    expect(state.loading()).toBe(false);
    expect(state.hasMoreDown()).toBe(false);
    expect(state.hasMoreUp()).toBe(false);
  });

  it('reload() loads the first page and resets scroll position', () => {
    const el = scrollEl({ scrollTop: 500, scrollHeight: 3000 });
    const fetchPage = vi.fn().mockReturnValue(of(page([1, 2, 3], 30)));
    const state = createPagedScrollWindow({
      pageSize: 3,
      fetchPage,
      scrollContainer: () => el,
    });

    state.reload();

    expect(fetchPage).toHaveBeenCalledWith(0);
    expect(state.items()).toEqual([1, 2, 3]);
    expect(state.loading()).toBe(false);
    expect(state.oldestPage()).toBe(0);
    expect(state.newestPage()).toBe(0);
    expect(el.scrollTop).toBe(0);
    expect(state.hasMoreDown()).toBe(true);
  });

  it('reload() keeps loading while the end of the list is near view, even if the page scrolls', () => {
    const el = scrollEl({ scrollTop: 0, scrollHeight: 1000, clientHeight: 800 });
    const fetchPage = vi
      .fn()
      .mockReturnValueOnce(of(page([1, 2, 3], 9)))
      .mockReturnValueOnce(of(page([4, 5, 6], 9)))
      .mockReturnValueOnce(of(page([7, 8, 9], 9)));
    const state = createPagedScrollWindow({ pageSize: 3, fetchPage, scrollContainer: () => el });

    state.reload();

    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(state.items()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(state.hasMoreDown()).toBe(false);
  });

  it('reload() reports errors via onError', () => {
    const onError = vi.fn();
    const state = createPagedScrollWindow({
      pageSize: 3,
      fetchPage: vi.fn().mockReturnValue(throwError(() => new Error('boom'))),
      scrollContainer: () => null,
      onError,
    });

    state.reload();

    expect(onError).toHaveBeenCalled();
    expect(state.loading()).toBe(false);
  });

  it('onScroll() loads the next page when near the bottom', () => {
    const el = scrollEl({ scrollHeight: 1000, clientHeight: 500, scrollTop: 900 });
    const fetchPage = vi
      .fn()
      .mockReturnValueOnce(of(page([1, 2, 3], 30)))
      .mockReturnValueOnce(of(page([4, 5, 6], 30)));
    const state = createPagedScrollWindow({
      pageSize: 3,
      scrollThreshold: 200,
      fetchPage,
      scrollContainer: () => el,
    });
    state.reload();
    el.scrollTop = 900;

    state.onScroll();

    expect(fetchPage).toHaveBeenCalledWith(1);
    expect(state.items()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(state.newestPage()).toBe(1);
  });

  it('onScroll() loads the previous page once trimming has created room above', () => {
    const el = scrollEl({ scrollHeight: 1000, clientHeight: 500, scrollTop: 900 });
    const fetchPage = vi
      .fn()
      .mockReturnValueOnce(of(page([1, 2, 3], 90)))
      .mockReturnValueOnce(of(page([4, 5, 6], 90)));
    const state = createPagedScrollWindow({
      pageSize: 3,
      maxLoaded: 4,
      scrollThreshold: 200,
      fetchPage,
      scrollContainer: () => el,
    });
    state.reload();
    el.scrollTop = 900;
    state.onScroll();
    expect(state.oldestPage()).toBe(1);
    expect(state.hasMoreUp()).toBe(true);

    el.scrollTop = 100;
    fetchPage.mockReturnValueOnce(of(page([0], 90)));
    state.onScroll();

    expect(fetchPage).toHaveBeenCalledWith(0);
    expect(state.items()[0]).toBe(0);
  });

  it('onScroll() does nothing when there is no scroll container', () => {
    const fetchPage = vi.fn();
    const state = createPagedScrollWindow({
      pageSize: 3,
      fetchPage,
      scrollContainer: () => null,
    });

    state.onScroll();

    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('onScroll() and reload() are no-ops when enabled() returns false', () => {
    const el = scrollEl({ scrollTop: 900, scrollHeight: 1000, clientHeight: 500 });
    const fetchPage = vi.fn().mockReturnValue(of(page([1, 2, 3], 30)));
    const state = createPagedScrollWindow({
      pageSize: 3,
      fetchPage,
      scrollContainer: () => el,
      enabled: () => false,
    });
    state.reload();
    fetchPage.mockClear();

    state.onScroll();

    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('loadNext() trims the oldest page once maxLoaded is exceeded', () => {
    const el = scrollEl({ scrollHeight: 1000, clientHeight: 500, scrollTop: 900 });
    const fetchPage = vi
      .fn()
      .mockReturnValueOnce(of(page([1, 2, 3], 90)))
      .mockReturnValueOnce(of(page([4, 5, 6], 90)));
    const state = createPagedScrollWindow({
      pageSize: 3,
      maxLoaded: 4,
      scrollThreshold: 200,
      fetchPage,
      scrollContainer: () => el,
    });
    state.reload();
    el.scrollTop = 900;

    state.onScroll();

    expect(state.items()).toEqual([4, 5, 6]);
    expect(state.oldestPage()).toBe(1);
  });

  it('loadNext() reports errors via onError', () => {
    const el = scrollEl({ scrollHeight: 1000, clientHeight: 100, scrollTop: 900 });
    const onError = vi.fn();
    const fetchPage = vi
      .fn()
      .mockReturnValueOnce(of(page([1, 2, 3], 30)))
      .mockReturnValueOnce(throwError(() => new Error('boom')));
    const state = createPagedScrollWindow({
      pageSize: 3,
      scrollThreshold: 200,
      fetchPage,
      scrollContainer: () => el,
      onError,
    });
    state.reload();
    el.scrollTop = 900;

    state.onScroll();

    expect(onError).toHaveBeenCalled();
    expect(state.loadingMore()).toBe(false);
  });
});
