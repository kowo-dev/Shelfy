import { signal } from '@angular/core';
import type { Subscription } from 'rxjs';
import { isVisibleMediaType, type MediaType } from '@app/core/services/collection/collection.model';
import type { SearchService } from '@app/core/services/search/search';
import { exploreQueryKey, type ExploreQuery } from '@app/core/services/search/explore-query';
import type { ExploreResponse, SearchResult } from '@app/core/services/search/search.model';
import { searchResultKey } from '@shared/utils/search-result-media.util';

const CACHE_LIMIT = 40;

export interface ExploreResultsDependencies {
  searchService: SearchService;
  region: () => string;
}

export function createExploreResults({ searchService, region }: ExploreResultsDependencies) {
  const results = signal<SearchResult[]>([]);
  const page = signal(0);
  const hasMore = signal(false);
  const loading = signal(false);
  const failed = signal(false);
  const loaded = signal(false);
  const refreshing = signal(false);
  const skippedTypes = signal<MediaType[]>([]);
  const unavailableProviders = signal<string[]>([]);
  const cache = new Map<string, ExploreResponse>();
  let current: ExploreQuery | null = null;
  let request = 0;
  let active: Subscription | null = null;

  function apply(response: ExploreResponse, append: boolean): void {
    const visible = response.results.filter((result) => isVisibleMediaType(result.mediaType));
    if (append) {
      const known = new Set(results().map(searchResultKey));
      results.update((list) => [
        ...list,
        ...visible.filter((result) => !known.has(searchResultKey(result))),
      ]);
    } else {
      results.set(visible);
    }
    page.set(response.page);
    hasMore.set(response.hasMore);
    skippedTypes.set(response.skippedTypes ?? []);
    unavailableProviders.set(response.unavailableProviders);
    loading.set(false);
    refreshing.set(false);
    loaded.set(true);
  }

  function fetch(target: number, append: boolean): void {
    if (!current) return;
    active?.unsubscribe();
    const query = current;
    const key = `${exploreQueryKey(query)}:${region()}:${target}`;
    const id = ++request;
    failed.set(false);
    const cached = cache.get(key);
    if (cached) {
      apply(cached, append);
      return;
    }
    loading.set(true);
    active = searchService.explore(query, target, region()).subscribe({
      next: (response) => {
        if (id !== request) return;
        if (response.unavailableProviders.length === 0) {
          if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
          cache.set(key, response);
        }
        apply(response, append);
      },
      error: () => {
        if (id !== request) return;
        if (!append) results.set([]);
        loading.set(false);
        refreshing.set(false);
        failed.set(true);
        loaded.set(true);
      },
    });
  }

  return {
    results,
    page,
    hasMore,
    loading,
    failed,
    loaded,
    refreshing,
    skippedTypes,
    unavailableProviders,
    load(query: ExploreQuery): void {
      current = query;
      refreshing.set(results().length > 0);
      page.set(0);
      hasMore.set(false);
      loaded.set(false);
      skippedTypes.set([]);
      unavailableProviders.set([]);
      fetch(1, false);
    },
    loadMore(): void {
      if (loading() || !hasMore() || failed()) return;
      fetch(page() + 1, true);
    },
    retry(): void {
      fetch(page() + 1, page() > 0);
    },
    cancel(): void {
      request++;
      active?.unsubscribe();
      loading.set(false);
      refreshing.set(false);
    },
    clear(): void {
      this.cancel();
      current = null;
      results.set([]);
      page.set(0);
      hasMore.set(false);
      failed.set(false);
      loaded.set(false);
    },
  };
}
