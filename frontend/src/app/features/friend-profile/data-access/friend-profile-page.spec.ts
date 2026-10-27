import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { CollectionService } from '@app/core/services/collection/collection';
import type { LocalStorageService } from '@app/core/services/local-storage/local-storage';

import { createFriendProfilePage } from './friend-profile-page';

describe('createFriendProfilePage', () => {
  let collectionService: { listForUser: ReturnType<typeof vi.fn> };
  let storage: LocalStorageService;

  beforeEach(() => {
    collectionService = {
      listForUser: vi
        .fn()
        .mockReturnValue(of({ content: [], page: 0, size: 24, totalElements: 0 })),
    };
    storage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
    } as unknown as LocalStorageService;
  });

  function build(windowEnabled = true) {
    return createFriendProfilePage(
      {
        username: () => 'friend1',
        scrollContainer: () => null,
        resetScrollTop: () => 0,
        windowEnabled: () => windowEnabled,
        onError: vi.fn(),
      },
      { collectionService: collectionService as unknown as CollectionService, storage },
    );
  }

  it('fetches the given username collection page on reload', () => {
    const page = build();
    page.reloadItems();

    expect(collectionService.listForUser).toHaveBeenCalledWith(
      'friend1',
      expect.objectContaining({ page: 0, size: 24 }),
    );
  });

  it('accumulates all pages when loading the full item list', () => {
    collectionService.listForUser
      .mockReturnValueOnce(
        of({
          content: [{ id: 'a' }],
          page: 0,
          size: 1,
          totalElements: 2,
        }),
      )
      .mockReturnValueOnce(
        of({
          content: [{ id: 'b' }],
          page: 1,
          size: 1,
          totalElements: 2,
        }),
      );

    const page = build();
    page.loadFullItems();

    expect(collectionService.listForUser).toHaveBeenCalledTimes(2);
    expect(page.fullItems().map((i: { id: string }) => i.id)).toEqual(['a', 'b']);
    expect(page.fullItemsLoading()).toBe(false);
  });

  it('reports the error and stops loading when a page fails', () => {
    const onError = vi.fn();
    collectionService.listForUser.mockReturnValue(throwError(() => new Error('boom')));

    const page = createFriendProfilePage(
      {
        username: () => 'friend1',
        scrollContainer: () => null,
        resetScrollTop: () => 0,
        windowEnabled: () => true,
        onError,
      },
      { collectionService: collectionService as unknown as CollectionService, storage },
    );

    page.loadFullItems();

    expect(onError).toHaveBeenCalled();
    expect(page.fullItemsLoading()).toBe(false);
  });
});
