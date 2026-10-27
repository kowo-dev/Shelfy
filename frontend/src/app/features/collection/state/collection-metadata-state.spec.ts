import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import type { CollectionService } from '@app/core/services/collection/collection';
import type { CollectionStatsResponse } from '@app/core/services/collection/collection.model';

import { createCollectionMetadataState } from './collection-metadata-state';

const STATS = { countsByMediaType: { movie: 3 }, total: 3 } as CollectionStatsResponse;

describe('createCollectionMetadataState', () => {
  it('starts empty', () => {
    const state = createCollectionMetadataState({ stats: vi.fn() } as unknown as CollectionService);

    expect(state.stats()).toBeNull();
    expect(state.mediaTypeCounts()).toEqual({});
    expect(state.mediaTypeTotal()).toBeNull();
  });

  it('load() reloads the stats', () => {
    const collectionService = {
      stats: vi.fn().mockReturnValue(of(STATS)),
    } as unknown as CollectionService;
    const state = createCollectionMetadataState(collectionService);

    state.load();

    expect(state.stats()).toEqual(STATS);
    expect(state.mediaTypeCounts()).toEqual({ movie: 3 });
    expect(state.mediaTypeTotal()).toBe(3);
  });

  it('reloadStats() swallows errors', () => {
    const collectionService = {
      stats: vi.fn().mockReturnValue(throwError(() => new Error('boom'))),
    } as unknown as CollectionService;
    const state = createCollectionMetadataState(collectionService);

    expect(() => state.reloadStats()).not.toThrow();
    expect(collectionService.stats).toHaveBeenCalled();
    expect(state.stats()).toBeNull();
  });
});
