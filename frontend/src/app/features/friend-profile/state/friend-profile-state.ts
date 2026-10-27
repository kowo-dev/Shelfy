import { signal, type Signal } from '@angular/core';
import { toApiError } from '@app/core/errors/api-error';
import { UserProfileService } from '@app/core/services/users/user-profile';
import { CollectionService } from '@app/core/services/collection/collection';
import type { UserProfileResponse } from '@app/core/services/people/people.model';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { subscribeWithLoading } from '@shared/utils/loadable-state.util';

export interface FriendProfileStateOptions {
  username: () => string;
  onError: (error: unknown) => void;
  onLoaded: () => void;
  signedIn?: () => boolean;
}

export interface FriendProfileStateDependencies {
  userProfileService: UserProfileService;
  collectionService: CollectionService;
}

export interface FriendProfileState {
  profile: Signal<UserProfileResponse | null>;
  notAvailable: Signal<boolean>;
  loading: Signal<boolean>;
  ownItemsByMediaId: Signal<Map<string, CollectionItemResponse>>;
  load: () => void;
  ownItemFor: (item: CollectionItemResponse) => CollectionItemResponse | null;
  applyOwnUpdate: (item: CollectionItemResponse) => void;
  applyOwnAdd: (item: CollectionItemResponse) => void;
  applyOwnRemoval: (ids: readonly string[]) => void;
  clearOwn: () => void;
}

export function createFriendProfileState(
  options: FriendProfileStateOptions,
  dependencies: FriendProfileStateDependencies,
): FriendProfileState {
  const { userProfileService, collectionService } = dependencies;

  const profile = signal<UserProfileResponse | null>(null);
  const notAvailable = signal(false);
  const loading = signal(true);
  const ownItemsByMediaId = signal(new Map<string, CollectionItemResponse>());

  function load(): void {
    notAvailable.set(false);
    subscribeWithLoading(
      userProfileService.getProfile(options.username()),
      (loaded) => {
        profile.set(loaded);
        if (options.signedIn?.() ?? true) loadOwnItems();
        options.onLoaded();
      },
      (error) => {
        if (toApiError(error).status === 404) {
          notAvailable.set(true);
        } else {
          options.onError(error);
        }
      },
      loading,
    );
  }

  function loadOwnItems(): void {
    loadOwnItemsPage(0, []);
  }

  function loadOwnItemsPage(pageNumber: number, items: CollectionItemResponse[]): void {
    subscribeWithLoading(
      collectionService.list({ page: pageNumber, size: 100 }),
      (page) => {
        const allItems = [...items, ...page.content];
        if ((page.page + 1) * page.size < page.totalElements) {
          loadOwnItemsPage(page.page + 1, allItems);
          return;
        }
        ownItemsByMediaId.set(new Map(allItems.map((item) => [item.media.canonicalWorkId, item])));
      },
      options.onError,
    );
  }

  function ownItemFor(item: CollectionItemResponse): CollectionItemResponse | null {
    return ownItemsByMediaId().get(item.media.canonicalWorkId) ?? null;
  }

  function applyOwnUpdate(item: CollectionItemResponse): void {
    const key = item.media.canonicalWorkId;
    if (!ownItemsByMediaId().has(key)) return;
    ownItemsByMediaId.update((map) => new Map(map).set(key, item));
  }

  function applyOwnAdd(item: CollectionItemResponse): void {
    ownItemsByMediaId.update((map) => new Map(map).set(item.media.canonicalWorkId, item));
  }

  function applyOwnRemoval(ids: readonly string[]): void {
    const removed = new Set(ids);
    const map = ownItemsByMediaId();
    const kept = [...map].filter(([, item]) => !removed.has(item.id));
    if (kept.length !== map.size) ownItemsByMediaId.set(new Map(kept));
  }

  return {
    profile: profile.asReadonly(),
    notAvailable: notAvailable.asReadonly(),
    loading: loading.asReadonly(),
    ownItemsByMediaId: ownItemsByMediaId.asReadonly(),
    load,
    ownItemFor,
    applyOwnUpdate,
    applyOwnAdd,
    applyOwnRemoval,
    clearOwn: () => ownItemsByMediaId.set(new Map()),
  };
}
