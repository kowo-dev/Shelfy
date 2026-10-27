import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';

import type { CollectionService } from '@app/core/services/collection/collection';
import type { UserProfileService } from '@app/core/services/users/user-profile';
import type {
  PagedResponse,
  CollectionItemResponse,
} from '@app/core/services/collection/collection.model';
import type { UserProfileResponse } from '@app/core/services/people/people.model';

import { createFriendProfileState } from './friend-profile-state';

function item(id: string, canonicalWorkId: string): CollectionItemResponse {
  return { id, media: { canonicalWorkId } } as CollectionItemResponse & { id: string };
}

function itemsPage(
  content: CollectionItemResponse[],
  page: number,
  size: number,
  totalElements: number,
): PagedResponse<CollectionItemResponse> {
  return { content, page, size, totalElements };
}

const PROFILE = { username: 'kowo' } as UserProfileResponse;
const NOT_FOUND = new HttpErrorResponse({ status: 404 });
const SERVER_ERROR = new HttpErrorResponse({ status: 500 });

describe('createFriendProfileState', () => {
  function makeDeps(overrides: {
    getProfile?: ReturnType<typeof vi.fn>;
    list?: ReturnType<typeof vi.fn>;
  }) {
    const userProfileService = {
      getProfile: overrides.getProfile ?? vi.fn().mockReturnValue(of(PROFILE)),
    } as unknown as UserProfileService;
    const collectionService = {
      list: overrides.list ?? vi.fn().mockReturnValue(of(itemsPage([], 0, 100, 0))),
    } as unknown as CollectionService;
    return { userProfileService, collectionService };
  }

  it('starts with loading=true and empty data', () => {
    const { userProfileService, collectionService } = makeDeps({
      getProfile: vi.fn().mockReturnValue({ subscribe: () => undefined }),
    });
    const state = createFriendProfileState(
      { username: () => 'kowo', onError: vi.fn(), onLoaded: vi.fn() },
      { userProfileService, collectionService },
    );

    expect(state.loading()).toBe(true);
    expect(state.profile()).toBeNull();
  });

  it('on success: sets profile, clears loading, loads own items, calls onLoaded', () => {
    const onLoaded = vi.fn();
    const { userProfileService, collectionService } = makeDeps({});
    const state = createFriendProfileState(
      { username: () => 'kowo', onError: vi.fn(), onLoaded },
      { userProfileService, collectionService },
    );

    state.load();

    expect(state.profile()).toEqual(PROFILE);
    expect(state.loading()).toBe(false);
    expect(state.notAvailable()).toBe(false);
    expect(onLoaded).toHaveBeenCalledTimes(1);
  });

  it('on 404: sets notAvailable, clears loading, does not call onError', () => {
    const onError = vi.fn();
    const { userProfileService, collectionService } = makeDeps({
      getProfile: vi.fn().mockReturnValue(throwError(() => NOT_FOUND)),
    });
    const state = createFriendProfileState(
      { username: () => 'kowo', onError, onLoaded: vi.fn() },
      { userProfileService, collectionService },
    );

    state.load();

    expect(state.notAvailable()).toBe(true);
    expect(state.loading()).toBe(false);
    expect(onError).not.toHaveBeenCalled();
  });

  it('on non-404 error: calls onError, clears loading, leaves notAvailable false', () => {
    const onError = vi.fn();
    const { userProfileService, collectionService } = makeDeps({
      getProfile: vi.fn().mockReturnValue(throwError(() => SERVER_ERROR)),
    });
    const state = createFriendProfileState(
      { username: () => 'kowo', onError, onLoaded: vi.fn() },
      { userProfileService, collectionService },
    );

    state.load();

    expect(state.notAvailable()).toBe(false);
    expect(state.loading()).toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('paginates own items across pages and keys them by canonicalWorkId', () => {
    const itemA = item('a', 'work-a');
    const itemB = item('b', 'work-b');
    const list = vi
      .fn()
      .mockReturnValueOnce(of(itemsPage([itemA], 0, 1, 2)))
      .mockReturnValueOnce(of(itemsPage([itemB], 1, 1, 2)));
    const { userProfileService, collectionService } = makeDeps({ list });
    const state = createFriendProfileState(
      { username: () => 'kowo', onError: vi.fn(), onLoaded: vi.fn() },
      { userProfileService, collectionService },
    );

    state.load();

    expect(state.ownItemFor(itemA)).toEqual(itemA);
    expect(state.ownItemFor(itemB)).toEqual(itemB);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('drops own items once they leave the shelf, and picks up new ones', () => {
    const itemA = item('a', 'work-a');
    const itemB = item('b', 'work-b');
    const list = vi.fn().mockReturnValue(of(itemsPage([itemA], 0, 100, 1)));
    const { userProfileService, collectionService } = makeDeps({ list });
    const state = createFriendProfileState(
      { username: () => 'kowo', onError: vi.fn(), onLoaded: vi.fn() },
      { userProfileService, collectionService },
    );
    state.load();

    state.applyOwnRemoval(['a']);
    state.applyOwnAdd(itemB);

    expect(state.ownItemFor(itemA)).toBeNull();
    expect(state.ownItemFor(itemB)).toEqual(itemB);
  });
});
