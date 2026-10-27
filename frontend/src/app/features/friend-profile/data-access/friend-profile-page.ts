import { signal, type Signal, type WritableSignal } from '@angular/core';
import { CollectionService } from '@app/core/services/collection/collection';
import type { LocalStorageService } from '@app/core/services/local-storage/local-storage';
import type {
  CollectionItemResponse,
  CollectionListParams,
} from '@app/core/services/collection/collection.model';
import {
  createPagedScrollWindow,
  type PagedScrollWindow,
} from '@app/shared/utils/paged-scroll-window';
import {
  createCollectionFilterState,
  type CollectionFilterState,
} from '@shared/utils/collection-filter-state';

const PAGE_SIZE = 24;
const STORAGE_KEY = 'friend-profile.filters';

export interface FriendProfilePageOptions {
  username: () => string;
  scrollContainer: () => HTMLElement | null;
  resetScrollTop: () => number;
  windowEnabled: () => boolean;
  onError: (error: unknown) => void;
}

export interface FriendProfilePageDependencies {
  collectionService: CollectionService;
  storage: LocalStorageService;
}

export interface FriendProfilePageData {
  filters: CollectionFilterState;
  searchTerm: WritableSignal<string>;
  window: PagedScrollWindow<CollectionItemResponse>;
  reloadItems: () => void;
  onScroll: () => void;
  fullItems: Signal<CollectionItemResponse[]>;
  fullItemsLoading: Signal<boolean>;
  loadFullItems: () => void;
  allItems: Signal<CollectionItemResponse[]>;
  loadAllItems: () => void;
}

export function createFriendProfilePage(
  options: FriendProfilePageOptions,
  dependencies: FriendProfilePageDependencies,
): FriendProfilePageData {
  const { collectionService } = dependencies;

  const filters = createCollectionFilterState({
    storageKey: STORAGE_KEY,
    storage: dependencies.storage,
  });
  const searchTerm = filters.searchTerm;

  function currentFilterParams() {
    return filters.listParams();
  }

  const window = createPagedScrollWindow<CollectionItemResponse>({
    pageSize: PAGE_SIZE,
    scrollContainer: options.scrollContainer,
    resetScrollTop: options.resetScrollTop,
    onError: options.onError,
    enabled: options.windowEnabled,
    fetchPage: (page) =>
      collectionService.listForUser(options.username(), {
        page,
        size: PAGE_SIZE,
        ...currentFilterParams(),
      }),
  });

  const fullItems = signal<CollectionItemResponse[]>([]);
  const fullItemsLoading = signal(false);

  const allItems = signal<CollectionItemResponse[]>([]);

  function loadFullItems(): void {
    fullItemsLoading.set(true);
    loadEveryPage(
      currentFilterParams(),
      (items) => fullItems.set(items),
      () => fullItemsLoading.set(false),
    );
  }

  function loadAllItems(): void {
    loadEveryPage(
      {},
      (items) => allItems.set(items),
      () => undefined,
    );
  }

  function loadEveryPage(
    params: CollectionListParams,
    done: (items: CollectionItemResponse[]) => void,
    settled: () => void,
    pageNumber = 0,
    items: CollectionItemResponse[] = [],
  ): void {
    collectionService
      .listForUser(options.username(), { ...params, page: pageNumber, size: 100 })
      .subscribe({
        next: (page) => {
          const loaded = [...items, ...page.content];
          if ((page.page + 1) * page.size < page.totalElements) {
            loadEveryPage(params, done, settled, page.page + 1, loaded);
            return;
          }
          done(loaded);
          settled();
        },
        error: (error: unknown) => {
          settled();
          options.onError(error);
        },
      });
  }

  return {
    filters,
    searchTerm,
    window,
    reloadItems: window.reload,
    onScroll: window.onScroll,
    fullItems,
    fullItemsLoading,
    loadFullItems,
    allItems,
    loadAllItems,
  };
}
