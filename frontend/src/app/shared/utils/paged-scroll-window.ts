import { computed, signal, type Signal, type WritableSignal } from '@angular/core';
import type { Observable } from 'rxjs';
import type { PagedResponse } from '@app/core/services/collection/collection.model';

export interface PagedScrollWindowOptions<T> {
  pageSize: number;
  maxLoaded?: number;
  scrollThreshold?: number;
  fetchPage: (page: number) => Observable<PagedResponse<T>>;
  scrollContainer: () => HTMLElement | null;
  resetScrollTop?: () => number;
  onError?: (error: unknown) => void;
  enabled?: () => boolean;
}

export interface PagedScrollWindow<T> {
  items: WritableSignal<T[]>;
  oldestPage: Signal<number>;
  newestPage: Signal<number>;
  totalElements: WritableSignal<number>;
  loading: Signal<boolean>;
  loadFailed: Signal<boolean>;
  loadingMore: Signal<boolean>;
  loadingPrevious: Signal<boolean>;
  hasMoreDown: Signal<boolean>;
  hasMoreUp: Signal<boolean>;
  reload: () => void;
  onScroll: () => void;
}

function appendPage<T>(items: T[], page: T[], pageSize: number, max: number) {
  const next = [...items, ...page];
  return next.length > max
    ? { items: next.slice(pageSize), droppedStart: true }
    : { items: next, droppedStart: false };
}

function prependPage<T>(items: T[], page: T[], max: number) {
  const next = [...page, ...items];
  return next.length > max
    ? { items: next.slice(0, max), droppedEnd: true }
    : { items: next, droppedEnd: false };
}

function createWindowState() {
  return {
    items: signal<unknown[]>([]),
    oldestPage: signal(0),
    newestPage: signal(0),
    totalElements: signal(0),
    loading: signal(false),
    loadFailed: signal(false),
    loadingMore: signal(false),
    loadingPrevious: signal(false),
  };
}

export function createPagedScrollWindow<T>(
  options: PagedScrollWindowOptions<T>,
): PagedScrollWindow<T> {
  const pageSize = options.pageSize;
  const maxLoaded = options.maxLoaded ?? pageSize * 25;
  const threshold = options.scrollThreshold ?? 600;
  const state = createWindowState();
  const items = state.items as WritableSignal<T[]>;
  const { oldestPage, newestPage, totalElements, loading, loadFailed } = state;
  const { loadingMore, loadingPrevious } = state;
  const hasMoreDown = computed(() => (newestPage() + 1) * pageSize < totalElements());
  const hasMoreUp = computed(() => oldestPage() > 0);

  function container(): HTMLElement | null {
    return options.enabled?.() === false ? null : options.scrollContainer();
  }

  function wantsNext(el: HTMLElement): boolean {
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distance < Math.max(threshold, el.clientHeight * 1.5) && hasMoreDown() && !loadingMore();
  }

  function maybeAutoLoadMore(): void {
    requestAnimationFrame(() => {
      const el = container();
      if (el && wantsNext(el)) loadNext();
    });
  }

  function reload(): void {
    loading.set(true);
    loadFailed.set(false);
    options.fetchPage(0).subscribe({
      next: (response) => {
        oldestPage.set(0);
        newestPage.set(0);
        totalElements.set(response.totalElements);
        items.set(response.content);
        loading.set(false);
        const el = options.scrollContainer();
        if (el) el.scrollTop = Math.min(el.scrollTop, options.resetScrollTop?.() ?? 0);
        maybeAutoLoadMore();
      },
      error: (error: unknown) => {
        loading.set(false);
        loadFailed.set(true);
        options.onError?.(error);
      },
    });
  }

  function loadNext(): void {
    loadingMore.set(true);
    const page = newestPage() + 1;
    options.fetchPage(page).subscribe({
      next: (response) => {
        newestPage.set(page);
        const next = appendPage(items(), response.content, pageSize, maxLoaded);
        items.set(next.items);
        if (next.droppedStart) oldestPage.update((p) => p + 1);
        loadingMore.set(false);
        maybeAutoLoadMore();
      },
      error: (error: unknown) => {
        loadingMore.set(false);
        options.onError?.(error);
      },
    });
  }

  function loadPrevious(): void {
    loadingPrevious.set(true);
    const page = oldestPage() - 1;
    options.fetchPage(page).subscribe({
      next: (response) => {
        const el = options.scrollContainer();
        const previousHeight = el?.scrollHeight ?? 0;
        oldestPage.set(page);
        const next = prependPage(items(), response.content, maxLoaded);
        items.set(next.items);
        if (next.droppedEnd) newestPage.update((p) => p - 1);
        loadingPrevious.set(false);
        if (el) requestAnimationFrame(() => (el.scrollTop += el.scrollHeight - previousHeight));
      },
      error: (error: unknown) => {
        loadingPrevious.set(false);
        options.onError?.(error);
      },
    });
  }

  function onScroll(): void {
    const el = container();
    if (!el) return;
    if (wantsNext(el)) loadNext();
    if (el.scrollTop < threshold && hasMoreUp() && !loadingPrevious()) loadPrevious();
  }

  return { ...state, items, hasMoreDown, hasMoreUp, reload, onScroll };
}
