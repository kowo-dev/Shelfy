import type { Injector, WritableSignal } from '@angular/core';
import { CollectionService } from '@app/core/services/collection/collection';
import type { LocalStorageService } from '@app/core/services/local-storage/local-storage';
import type {
  CollectionItemResponse,
  UserMediaStatus,
} from '@app/core/services/collection/collection.model';
import {
  createPagedScrollWindow,
  type PagedScrollWindow,
} from '@app/shared/utils/paged-scroll-window';
import {
  watchCollectionChanges,
  type CollectionChangeHandlers,
} from '@shared/utils/collection-change-sync';
import {
  createCollectionFilterState,
  type CollectionFilterState,
} from '@shared/utils/collection-filter-state';
import {
  createCollectionMetadataState,
  type CollectionMetadataState,
} from '../state/collection-metadata-state';

export interface CollectionPageOptions {
  scrollContainer: () => HTMLElement | null;
  resetScrollTop?: () => number;
  onError: (error: unknown) => void;
}

export interface CollectionPageDependencies {
  collectionService: CollectionService;
  injector: Injector;
  storage: LocalStorageService;
}

export interface CollectionPageData {
  filters: CollectionFilterState;
  metadata: CollectionMetadataState;
  searchTerm: WritableSignal<string>;
  window: PagedScrollWindow<CollectionItemResponse>;
  reloadItems: () => void;
  onScroll: () => void;
  matchesFilters: (item: CollectionItemResponse) => boolean;
  watchChanges: (handlers: CollectionChangeHandlers) => void;
}

export const SHELVED: UserMediaStatus[] = ['ongoing', 'done', 'dropped'];

export function createCollectionPage(
  options: CollectionPageOptions,
  dependencies: CollectionPageDependencies,
): CollectionPageData {
  const { collectionService } = dependencies;
  const filters = createCollectionFilterState({
    storageKey: 'collection.filters.all',
    storage: dependencies.storage,
  });
  const searchTerm = filters.searchTerm;
  const window = createPagedScrollWindow<CollectionItemResponse>({
    pageSize: 24,
    scrollContainer: options.scrollContainer,
    resetScrollTop: options.resetScrollTop,
    onError: options.onError,
    fetchPage: (page) =>
      collectionService.list({
        page,
        size: 24,
        ...filters.listParams(),
        status: filters.statusFilter().length ? filters.statusFilter() : SHELVED,
      }),
  });

  function matchesFilters(item: CollectionItemResponse): boolean {
    const statuses = filters.statusFilter().length ? filters.statusFilter() : SHELVED;
    if (!statuses.includes(item.status)) return false;
    const mediaTypes = filters.mediaTypeFilter();
    if (mediaTypes.length > 0 && !mediaTypes.includes(item.media.mediaType)) return false;
    const from = filters.ratingFrom();
    const to = filters.ratingTo();
    if (item.rating === null) {
      if (from !== 'unrated' && !filters.includeUnrated()) return false;
    } else if ((from !== 'unrated' && item.rating < from) || item.rating > to) {
      return false;
    }
    const search = searchTerm().trim().toLowerCase();
    return !search || item.media.title.toLowerCase().includes(search);
  }

  return {
    filters,
    metadata: createCollectionMetadataState(collectionService),
    searchTerm,
    window,
    reloadItems: window.reload,
    onScroll: window.onScroll,
    matchesFilters,
    watchChanges: (handlers) =>
      watchCollectionChanges(collectionService, dependencies.injector, handlers),
  };
}
