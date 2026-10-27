import { signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CollectionService } from '@app/core/services/collection/collection';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { SearchService } from '@app/core/services/search/search';
import { ToastService } from '@app/core/services/toast/toast';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import type { BannerCandidate } from './banner-picker-dialog';
import { toShelfCandidates } from './banner-sources';

const SHELF_SIZE = 36;
const SEARCH_DEBOUNCE_MS = 250;

export interface BannerSearchDeps {
  searchService?: SearchService;
  collectionService?: CollectionService;
  toastService: ToastService;
  errorMessage: ErrorMessageService;
  scope: 'catalog' | 'shelf';
  coverUrl: (result: BannerCandidate['result']) => string | null;
  onQueryEdited: () => void;
}

export function createBannerSearch(deps: BannerSearchDeps) {
  const { searchService, collectionService, toastService, errorMessage, scope, coverUrl } = deps;
  const onError = catchAndToastError(toastService, errorMessage);

  let request = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const query = signal('');
  const results = signal<BannerCandidate[]>([]);
  const loading = signal(false);
  const loadingMore = signal(false);
  const hasMore = signal(false);
  const unavailableProviders = signal<string[]>([]);
  const page = signal(0);
  const shelfResults = signal<BannerCandidate[]>([]);
  const shelfLoading = signal(false);

  async function loadShelf(): Promise<void> {
    if (!collectionService || shelfResults().length > 0) return;
    shelfLoading.set(true);
    try {
      const response = await firstValueFrom(
        collectionService.list({ size: SHELF_SIZE, sortBy: 'addedAt', sortDirection: 'desc' }),
      );
      shelfResults.set(toShelfCandidates(response.content));
    } catch {
      shelfResults.set([]);
    } finally {
      shelfLoading.set(false);
    }
  }

  async function searchCatalog(text: string, pageNumber: number, id: number, append: boolean) {
    if (!searchService) return;
    try {
      const response = await firstValueFrom(searchService.search(text, pageNumber));
      if (id !== request) return;
      const mapped = response.results.map((result) => ({ result, coverUrl: coverUrl(result) }));
      results.update((current) => (append ? [...current, ...mapped] : mapped));
      hasMore.set(response.hasMore);
      unavailableProviders.set(response.unavailableProviders);
      page.set(response.page);
    } catch (error) {
      if (id === request) onError(error);
    } finally {
      if (id === request) {
        loading.set(false);
        loadingMore.set(false);
      }
    }
  }

  async function searchShelf(text: string, _page: number, id: number): Promise<void> {
    if (!collectionService) return;
    try {
      const response = await firstValueFrom(
        collectionService.list({ search: text, size: SHELF_SIZE }),
      );
      if (id === request) results.set(toShelfCandidates(response.content));
    } catch (error) {
      if (id === request) onError(error);
    } finally {
      if (id === request) loading.set(false);
    }
  }

  function onQueryChange(next: string): void {
    deps.onQueryEdited();
    query.set(next);
    results.set([]);
    hasMore.set(false);
    unavailableProviders.set([]);
    const id = ++request;
    if (timer) clearTimeout(timer);

    const text = next.trim();
    if (!text) {
      loading.set(false);
      return;
    }
    loading.set(true);
    const run = scope === 'shelf' ? searchShelf : searchCatalog;
    timer = setTimeout(() => void run(text, 1, id, false), SEARCH_DEBOUNCE_MS);
  }

  function loadMoreResults(): void {
    const text = query().trim();
    if (scope === 'shelf' || !text || !hasMore() || loadingMore()) return;
    loadingMore.set(true);
    void searchCatalog(text, page() + 1, ++request, true);
  }

  function reset(): void {
    request++;
    query.set('');
    results.set([]);
    loading.set(false);
    loadingMore.set(false);
    hasMore.set(false);
    unavailableProviders.set([]);
    page.set(0);
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return {
    state: {
      query: query.asReadonly(),
      results: results.asReadonly(),
      loading: loading.asReadonly(),
      loadingMore: loadingMore.asReadonly(),
      hasMore: hasMore.asReadonly(),
      unavailableProviders: unavailableProviders.asReadonly(),
      shelfResults: shelfResults.asReadonly(),
      shelfLoading: shelfLoading.asReadonly(),
      onQueryChange,
      loadMoreResults,
    },
    loadShelf,
    reset,
  };
}
