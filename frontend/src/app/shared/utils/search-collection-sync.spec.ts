import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import type { CollectionService } from '@app/core/services/collection/collection';
import type {
  CollectionChangeEvent,
  CollectionItemResponse,
} from '@app/core/services/collection/collection.model';
import type { SearchResult } from '@app/core/services/search/search.model';

import { createSearchCollectionSync, resultKey } from './search-collection-sync';

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    provider: 'tmdb',
    mediaType: 'movie',
    externalId: '1',
    isInCollection: false,
    ...overrides,
  } as SearchResult;
}

function item(
  id: string,
  provider = 'tmdb',
  mediaType = 'movie',
  externalId = '1',
): CollectionItemResponse {
  return { id, media: { provider, mediaType, externalId } } as CollectionItemResponse;
}

describe('createSearchCollectionSync', () => {
  function setup(overrides: { lookupBatch?: ReturnType<typeof vi.fn> } = {}) {
    const allResults = signal<SearchResult[]>([]);
    const changes = new Subject<CollectionChangeEvent>();
    const collectionService = {
      changes,
      lookupBatch: overrides.lookupBatch ?? vi.fn().mockReturnValue(of({})),
    } as unknown as CollectionService;
    const injector = TestBed.inject(Injector);
    const sync = createSearchCollectionSync({ collectionService, allResults, injector });
    TestBed.flushEffects();
    return { allResults, changes, collectionService, sync };
  }

  it('resultKey() builds a stable key from provider/mediaType/externalId', () => {
    expect(resultKey(result())).toBe('tmdb:movie:1');
  });

  it('starts with an empty collection map', () => {
    const { sync } = setup();
    expect(sync.collectionItemByKey()).toEqual({});
  });

  it('fetches lookup data in bulk for results flagged inCollection but not yet cached', () => {
    const found = item('c1');
    const lookupBatch = vi.fn().mockReturnValue(of({ 'tmdb:movie:1': found }));
    const { allResults, sync } = setup({ lookupBatch });

    allResults.set([result({ isInCollection: true })]);
    TestBed.flushEffects();

    expect(lookupBatch).toHaveBeenCalledWith([
      { provider: 'tmdb', mediaType: 'movie', externalId: '1' },
    ]);
    expect(sync.collectionItemByKey()).toEqual({ 'tmdb:movie:1': found });
  });

  it('does not refetch results already cached or already loading', () => {
    const lookupBatch = vi.fn().mockReturnValue(of({}));
    const { allResults } = setup({ lookupBatch });

    allResults.set([
      result({ isInCollection: true }),
      result({ isInCollection: false, externalId: '2' }),
    ]);
    TestBed.flushEffects();

    expect(lookupBatch).toHaveBeenCalledTimes(1);
  });

  it('swallows lookup errors without throwing', () => {
    const lookupBatch = vi.fn().mockReturnValue(throwError(() => new Error('boom')));
    const { allResults, sync } = setup({ lookupBatch });

    allResults.set([result({ isInCollection: true })]);
    expect(() => TestBed.flushEffects()).not.toThrow();
    expect(sync.collectionItemByKey()).toEqual({});
  });

  it('applies a created collection change event and marks the matching result inCollection', () => {
    const { allResults, changes, sync } = setup();
    allResults.set([result({ isInCollection: false })]);

    changes.next({ type: 'created', item: item('c1') });
    TestBed.flushEffects();

    expect(sync.collectionItemByKey()['tmdb:movie:1']).toEqual(item('c1'));
    expect(allResults()[0].isInCollection).toBe(true);
  });

  it('applies a removed collection change event and clears inCollection on the matching result', () => {
    const { allResults, changes, sync } = setup();
    allResults.set([result({ isInCollection: true })]);
    changes.next({ type: 'created', item: item('c1') });
    TestBed.flushEffects();

    changes.next({ type: 'removed', id: 'c1' });
    TestBed.flushEffects();

    expect(sync.collectionItemByKey()).toEqual({});
    expect(allResults()[0].isInCollection).toBe(false);
  });

  it('applies a cleared collection change event and resets inCollection on all results', () => {
    const { allResults, changes, sync } = setup();
    allResults.set([result({ isInCollection: true })]);
    changes.next({ type: 'created', item: item('c1') });
    TestBed.flushEffects();

    changes.next({ type: 'cleared' });
    TestBed.flushEffects();

    expect(sync.collectionItemByKey()).toEqual({});
    expect(allResults()[0].isInCollection).toBe(false);
  });

  it('applies bulkUpdated and bulkRemoved collection change events', () => {
    const { changes, sync } = setup();

    changes.next({ type: 'bulkUpdated', items: [item('c1'), item('c2', 'tmdb', 'movie', '2')] });
    TestBed.flushEffects();
    expect(Object.keys(sync.collectionItemByKey())).toEqual(
      expect.arrayContaining(['tmdb:movie:1', 'tmdb:movie:2']),
    );

    changes.next({ type: 'bulkRemoved', ids: ['c1', 'c2'] });
    TestBed.flushEffects();
    expect(sync.collectionItemByKey()).toEqual({});
  });
});
