import { signal, type WritableSignal } from '@angular/core';
import type { LocalStorageService } from '@app/core/services/local-storage/local-storage';
import type {
  CollectionListParams,
  CollectionSortBy,
  CollectionSortDirection,
  MediaType,
  UserMediaStatus,
} from '@app/core/services/collection/collection.model';
import type { RatingBound } from '@shared/utils/collection-filter.types';

interface StoredFilters {
  mediaTypeFilter: MediaType[];
  ratingFrom: RatingBound;
  ratingTo: number;
  includeUnrated?: boolean;
  sortBy: CollectionSortBy;
  sortDirection: CollectionSortDirection | null;
  hasNote: boolean;
  searchTerm: string;
}

export interface CollectionFilterState {
  statusFilter: WritableSignal<UserMediaStatus[]>;
  mediaTypeFilter: WritableSignal<MediaType[]>;
  ratingFrom: WritableSignal<RatingBound>;
  ratingTo: WritableSignal<number>;
  includeUnrated: WritableSignal<boolean>;
  sortBy: WritableSignal<CollectionSortBy>;
  sortDirection: WritableSignal<CollectionSortDirection | null>;
  hasNote: WritableSignal<boolean>;
  searchTerm: WritableSignal<string>;
  save: () => void;
  listParams: () => CollectionListParams;
  clear: () => void;
  handlers: (afterChange: () => void) => CollectionFilterHandlers;
}

interface CollectionFilterHandlers {
  onSearchChange: (value: string) => void;
  onSortByChange: (value: CollectionSortBy) => void;
  onSortDirectionChange: (value: CollectionSortDirection | null) => void;
  onStatusFilterChange: (values: UserMediaStatus[]) => void;
  onMediaTypeFilterChange: (values: MediaType[]) => void;
  onRatingFromChange: (from: RatingBound) => void;
  onRatingToChange: (to: number) => void;
  onRatingRangeChange: (from: number, to: number) => void;
  onIncludeUnratedChange: (value: boolean) => void;
  onHasNoteChange: (value: boolean) => void;
}

export interface CollectionFilterStateOptions {
  storageKey: string;
  storage: LocalStorageService;
}

export function createCollectionFilterState(
  options: CollectionFilterStateOptions,
): CollectionFilterState {
  const { storageKey, storage } = options;
  const stored = load(storage, storageKey);

  const statusFilter = signal<UserMediaStatus[]>([]);
  const mediaTypeFilter = signal<MediaType[]>((stored?.mediaTypeFilter ?? []).slice(0, 1));
  const ratingFrom = signal<RatingBound>(stored?.ratingFrom ?? 'unrated');
  const ratingTo = signal(stored?.ratingTo ?? 10);
  const includeUnrated = signal(stored?.includeUnrated ?? false);
  const sortBy = signal<CollectionSortBy>(stored?.sortBy ?? 'addedAt');
  const sortDirection = signal<CollectionSortDirection | null>(stored?.sortDirection ?? null);
  const hasNote = signal(stored?.hasNote ?? false);
  const searchTerm = signal(stored?.searchTerm ?? '');

  function save(): void {
    const filters: StoredFilters = {
      mediaTypeFilter: mediaTypeFilter(),
      ratingFrom: ratingFrom(),
      ratingTo: ratingTo(),
      includeUnrated: includeUnrated(),
      sortBy: sortBy(),
      sortDirection: sortDirection(),
      hasNote: hasNote(),
      searchTerm: searchTerm(),
    };
    storage.setItem(storageKey, JSON.stringify(filters));
  }

  function listParams(): CollectionListParams {
    const from = ratingFrom();
    const direction = sortDirection();
    return {
      status: statusFilter().length ? statusFilter() : undefined,
      mediaType: mediaTypeFilter().length ? mediaTypeFilter() : undefined,
      includeUnrated: from === 'unrated' || includeUnrated(),
      minRating: from === 'unrated' ? undefined : from,
      maxRating: ratingTo(),
      search: searchTerm().trim() || undefined,
      sortBy: direction ? sortBy() : undefined,
      sortDirection: direction ?? undefined,
      hasNote: hasNote() || undefined,
    };
  }

  function clear(): void {
    statusFilter.set([]);
    mediaTypeFilter.set([]);
    ratingFrom.set('unrated');
    ratingTo.set(10);
    includeUnrated.set(false);
    hasNote.set(false);
    searchTerm.set('');
    save();
  }

  function handlers(afterChange: () => void): CollectionFilterHandlers {
    const changed = (): void => {
      save();
      afterChange();
    };
    return {
      onSearchChange: (value) => (searchTerm.set(value), changed()),
      onSortByChange: (value) => (sortBy.set(value), changed()),
      onSortDirectionChange: (value) => (sortDirection.set(value), changed()),
      onStatusFilterChange: (values) => (statusFilter.set(values), afterChange()),
      onMediaTypeFilterChange: (values) => (mediaTypeFilter.set(values), changed()),
      onRatingFromChange: (from) => {
        ratingFrom.set(from);
        if (from !== 'unrated' && from > ratingTo()) ratingTo.set(from);
        changed();
      },
      onRatingToChange: (to) => {
        ratingTo.set(to);
        const from = ratingFrom();
        if (from !== 'unrated' && from > to) ratingFrom.set(to);
        changed();
      },
      onRatingRangeChange: (from, to) => {
        if (ratingFrom() === 'unrated') includeUnrated.set(true);
        ratingFrom.set(Math.min(from, to));
        ratingTo.set(Math.max(from, to));
        changed();
      },
      onIncludeUnratedChange: (value) => {
        if (ratingFrom() === 'unrated') ratingFrom.set(1);
        includeUnrated.set(value);
        changed();
      },
      onHasNoteChange: (value) => (hasNote.set(value), changed()),
    };
  }

  return {
    statusFilter,
    mediaTypeFilter,
    ratingFrom,
    ratingTo,
    includeUnrated,
    sortBy,
    sortDirection,
    hasNote,
    searchTerm,
    save,
    listParams,
    clear,
    handlers,
  };
}

function load(storage: LocalStorageService, storageKey: string): StoredFilters | null {
  const raw = storage.getItem(storageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredFilters;
  } catch {
    return null;
  }
}
