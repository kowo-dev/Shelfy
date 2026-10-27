import { vi } from 'vitest';
import type { LocalStorageService } from '@app/core/services/local-storage/local-storage';
import { createCollectionFilterState } from './collection-filter-state';

function storage(initial: Record<string, string> = {}): LocalStorageService {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  } as unknown as LocalStorageService;
}

describe('createCollectionFilterState', () => {
  it('defaults to every status and empty filters when nothing is stored', () => {
    const state = createCollectionFilterState({ storageKey: 'k', storage: storage() });

    expect(state.statusFilter()).toEqual([]);
    expect(state.mediaTypeFilter()).toEqual([]);
    expect(state.ratingFrom()).toBe('unrated');
    expect(state.ratingTo()).toBe(10);
    expect(state.sortBy()).toBe('addedAt');
    expect(state.sortDirection()).toBeNull();
  });

  it('loads persisted filters from storage but never a persisted status', () => {
    const persisted = {
      statusFilter: ['done'],
      mediaTypeFilter: ['movie'],
      ratingFrom: 5,
      ratingTo: 9,
      sortBy: 'rating',
      sortDirection: 'desc',
      hasNote: true,
    };
    const state = createCollectionFilterState({
      storageKey: 'k',
      storage: storage({ k: JSON.stringify(persisted) }),
    });

    expect(state.statusFilter()).toEqual([]);
    expect(state.mediaTypeFilter()).toEqual(['movie']);
    expect(state.hasNote()).toBe(true);
    expect(state.sortDirection()).toBe('desc');
  });

  it('falls back to defaults when stored JSON is invalid', () => {
    const state = createCollectionFilterState({
      storageKey: 'k',
      storage: storage({ k: 'not-json' }),
    });

    expect(state.mediaTypeFilter()).toEqual([]);
    expect(state.sortBy()).toBe('addedAt');
  });

  it('persists the current signal values via save()', () => {
    const store = storage();
    const state = createCollectionFilterState({
      storageKey: 'k',
      storage: store,
    });

    state.hasNote.set(true);
    state.sortBy.set('title');
    state.save();

    expect(store.getItem('k')).not.toBeNull();
    const saved = JSON.parse(store.getItem('k')!);
    expect(saved.hasNote).toBe(true);
    expect(saved.sortBy).toBe('title');
  });

  it('turns the filters into request params', () => {
    const state = createCollectionFilterState({
      storageKey: 'k',
      storage: storage(),
    });
    state.ratingFrom.set(6);
    state.hasNote.set(true);

    const params = state.listParams();

    expect(params).toMatchObject({
      minRating: 6,
      maxRating: 10,
      includeUnrated: false,
      hasNote: true,
    });
  });

  describe('handlers', () => {
    function setup() {
      const store = storage();
      const state = createCollectionFilterState({
        storageKey: 'k',
        storage: store,
      });
      const after = vi.fn();
      return { state, after, store, handlers: state.handlers(after) };
    }

    it('applies a change, saves it and then lets the page reload', () => {
      const { state, after, store, handlers } = setup();

      handlers.onHasNoteChange(true);

      expect(state.hasNote()).toBe(true);
      expect(JSON.parse(store.getItem('k')!).hasNote).toBe(true);
      expect(after).toHaveBeenCalledTimes(1);
    });

    it('applies a status change without persisting it', () => {
      const { state, after, store, handlers } = setup();

      handlers.onStatusFilterChange(['done']);

      expect(state.statusFilter()).toEqual(['done']);
      expect(store.getItem('k')).toBeNull();
      expect(after).toHaveBeenCalledTimes(1);
    });

    it('drags the upper rating bound up when the lower one passes it', () => {
      const { state, handlers } = setup();
      handlers.onRatingToChange(4);

      handlers.onRatingFromChange(7);

      expect(state.ratingFrom()).toBe(7);
      expect(state.ratingTo()).toBe(7);
    });

    it('drags the lower rating bound down when the upper one passes it', () => {
      const { state, handlers } = setup();
      handlers.onRatingFromChange(8);

      handlers.onRatingToChange(5);

      expect(state.ratingFrom()).toBe(5);
    });

    it('leaves an unrated lower bound alone', () => {
      const { state, handlers } = setup();

      handlers.onRatingToChange(3);

      expect(state.ratingFrom()).toBe('unrated');
    });
  });

  it('clear resets every filter to all statuses and saves', () => {
    const store = storage();
    const state = createCollectionFilterState({
      storageKey: 'k',
      storage: store,
    });
    state.handlers(() => undefined).onSearchChange('dune');
    state.hasNote.set(true);

    state.statusFilter.set(['planned']);

    state.clear();

    expect(state.statusFilter()).toEqual([]);
    expect(state.searchTerm()).toBe('');
    expect(state.hasNote()).toBe(false);
    expect(JSON.parse(store.getItem('k')!).searchTerm).toBe('');
  });
});
