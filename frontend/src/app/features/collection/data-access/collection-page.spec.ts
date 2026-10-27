import { NEVER, of } from 'rxjs';
import { vi } from 'vitest';
import type { Injector } from '@angular/core';

import { CollectionService } from '@app/core/services/collection/collection';
import type { LocalStorageService } from '@app/core/services/local-storage/local-storage';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';

import { createCollectionPage } from './collection-page';

function item(overrides: Partial<CollectionItemResponse> = {}): CollectionItemResponse {
  return {
    id: 'i1',
    userId: 'u1',
    media: {
      id: 'm1',
      canonicalWorkId: 'c1',
      externalId: 'e1',
      provider: 'tmdb',
      mediaType: 'movie',
      title: 'The Matrix',
      coverUrl: null,
      metadata: null,
      createdAt: '2024-01-01T00:00:00Z',
    },
    status: 'done',
    rating: null,
    note: null,
    containsSpoilers: false,
    progress: {},
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('createCollectionPage', () => {
  let collectionService: {
    list: ReturnType<typeof vi.fn>;
    changes: typeof NEVER;
  };
  let storage: LocalStorageService;

  beforeEach(() => {
    collectionService = {
      list: vi.fn().mockReturnValue(of({ content: [], page: 0, size: 24, totalElements: 0 })),
      changes: NEVER,
    };
    storage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
    } as unknown as LocalStorageService;
  });

  function build() {
    return createCollectionPage(
      {
        scrollContainer: () => null,
        onError: vi.fn(),
      },
      {
        collectionService: collectionService as unknown as CollectionService,
        injector: {} as Injector,
        storage,
      },
    );
  }

  it('fetches items with the current filters', () => {
    const page = build();
    page.reloadItems();

    expect(collectionService.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 0, size: 24 }),
    );
  });

  it('matchesFilters honors status and media type filters', () => {
    const page = build();
    page.filters.statusFilter.set(['done']);
    page.filters.mediaTypeFilter.set(['movie']);

    expect(page.matchesFilters(item({ status: 'planned' }))).toBe(false);
    expect(page.matchesFilters(item({ status: 'done', media: item().media }))).toBe(true);
  });

  it('matchesFilters leaves the backlog out of All', () => {
    const page = build();

    expect(page.matchesFilters(item({ status: 'planned' }))).toBe(false);
    expect(page.matchesFilters(item({ status: 'ongoing' }))).toBe(true);
  });

  it('matchesFilters honors the search term against the title', () => {
    const page = build();
    page.searchTerm.set('matrix');

    expect(page.matchesFilters(item())).toBe(true);

    page.searchTerm.set('nope');
    expect(page.matchesFilters(item())).toBe(false);
  });

  it('matchesFilters honors the rating range, including the unrated lower bound', () => {
    const page = build();
    page.filters.ratingFrom.set('unrated');
    page.filters.ratingTo.set(5);

    expect(page.matchesFilters(item({ rating: null }))).toBe(true);
    expect(page.matchesFilters(item({ rating: 7 }))).toBe(false);

    page.filters.ratingFrom.set(6);
    page.filters.ratingTo.set(10);
    expect(page.matchesFilters(item({ rating: null }))).toBe(false);
    expect(page.matchesFilters(item({ rating: 8 }))).toBe(true);
  });
});
