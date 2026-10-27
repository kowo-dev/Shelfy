import { Injector } from '@angular/core';
import { Subject } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import type { CollectionService } from '@app/core/services/collection/collection';
import type {
  CollectionChangeEvent,
  CollectionItemResponse,
} from '@app/core/services/collection/collection.model';

import { watchCollectionChanges, type CollectionChangeHandlers } from './collection-change-sync';

function item(id: string): CollectionItemResponse {
  return { id } as CollectionItemResponse;
}

function makeHandlers(): CollectionChangeHandlers {
  return {
    onCreated: vi.fn(),
    onUpdated: vi.fn(),
    onRemoved: vi.fn(),
    onBulkUpdated: vi.fn(),
    onBulkRemoved: vi.fn(),
    onCleared: vi.fn(),
    onChangeApplied: vi.fn(),
  };
}

describe('watchCollectionChanges', () => {
  function setup() {
    const changes = new Subject<CollectionChangeEvent>();
    const collectionService = { changes } as unknown as CollectionService;
    const injector = TestBed.inject(Injector);
    const handlers = makeHandlers();
    watchCollectionChanges(collectionService, injector, handlers);
    TestBed.flushEffects();
    return { changes, handlers };
  }

  it('does nothing when there is no event yet', () => {
    const { handlers } = setup();

    expect(handlers.onChangeApplied).not.toHaveBeenCalled();
  });

  it('dispatches onCreated for a created event', () => {
    const { changes, handlers } = setup();
    const created = item('1');

    changes.next({ type: 'created', item: created });
    TestBed.flushEffects();

    expect(handlers.onCreated).toHaveBeenCalledWith(created);
    expect(handlers.onChangeApplied).toHaveBeenCalledTimes(1);
  });

  it('dispatches onUpdated for an updated event', () => {
    const { changes, handlers } = setup();
    const updated = item('1');

    changes.next({ type: 'updated', item: updated });
    TestBed.flushEffects();

    expect(handlers.onUpdated).toHaveBeenCalledWith(updated);
  });

  it('dispatches onRemoved with the id for a removed event', () => {
    const { changes, handlers } = setup();

    changes.next({ type: 'removed', id: '1' });
    TestBed.flushEffects();

    expect(handlers.onRemoved).toHaveBeenCalledWith('1');
  });

  it('dispatches onCleared for a cleared event', () => {
    const { changes, handlers } = setup();

    changes.next({ type: 'cleared' });
    TestBed.flushEffects();

    expect(handlers.onCleared).toHaveBeenCalled();
  });

  it('dispatches onBulkUpdated for a bulkUpdated event', () => {
    const { changes, handlers } = setup();
    const items = [item('1'), item('2')];

    changes.next({ type: 'bulkUpdated', items });
    TestBed.flushEffects();

    expect(handlers.onBulkUpdated).toHaveBeenCalledWith(items);
  });

  it('dispatches onBulkRemoved for a bulkRemoved event', () => {
    const { changes, handlers } = setup();

    changes.next({ type: 'bulkRemoved', ids: ['1', '2'] });
    TestBed.flushEffects();

    expect(handlers.onBulkRemoved).toHaveBeenCalledWith(['1', '2']);
  });
});
