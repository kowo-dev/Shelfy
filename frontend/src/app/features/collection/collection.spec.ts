import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { CollectionService } from '@app/core/services/collection/collection';
import { ItemSheetService } from '@app/core/services/item-sheet/item-sheet';
import { LocalStorageService } from '@app/core/services/local-storage/local-storage';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { TranslateService } from '@app/core/services/translate/translate';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';

import { CollectionPageComponent } from './collection';

const emptyPage = { content: [], page: 0, size: 24, totalElements: 0 };

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
    rating: 8,
    note: null,
    containsSpoilers: false,
    progress: {},
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('CollectionPageComponent', () => {
  let collectionService: {
    list: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    bulkRemove: ReturnType<typeof vi.fn>;
    bulkUpdate: ReturnType<typeof vi.fn>;
    stats: ReturnType<typeof vi.fn>;
    changes: typeof NEVER;
  };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let errorMessage: { fromApiError: ReturnType<typeof vi.fn> };

  let stored: Map<string, string>;
  let storage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
  };

  beforeEach(async () => {
    stored = new Map();
    storage = {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => void stored.set(key, value),
    };
    collectionService = {
      list: vi.fn().mockReturnValue(of(emptyPage)),
      remove: vi.fn().mockReturnValue(of(undefined)),
      update: vi.fn().mockReturnValue(of(item())),
      bulkRemove: vi.fn().mockReturnValue(of(undefined)),
      bulkUpdate: vi.fn().mockReturnValue(of([])),
      stats: vi.fn().mockReturnValue(of(null)),
      changes: NEVER,
    };
    toastService = { success: vi.fn(), error: vi.fn() };
    errorMessage = { fromApiError: vi.fn().mockReturnValue('error') };

    await TestBed.configureTestingModule({
      imports: [CollectionPageComponent],
      providers: [
        provideRouter([]),
        { provide: CollectionService, useValue: collectionService },
        { provide: LocalStorageService, useValue: storage },
        { provide: ToastService, useValue: toastService },
        { provide: ErrorMessageService, useValue: errorMessage },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(CollectionPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows an updated item that matches the filters and ignores ones that do not', () => {
    const component = createComponent().componentInstance;

    component.onItemUpdated(item({ id: 'moved' }));
    expect(component.items().map((entry) => entry.id)).toEqual(['moved']);
    expect(component.totalElements()).toBe(1);

    component.statusFilter.set(['done']);
    component.onItemUpdated(item({ id: 'other', status: 'planned' }));
    component.onItemDeleted('unknown');
    expect(component.totalElements()).toBe(1);
  });

  it('opens on every status but the backlog, and filters on several statuses at once', () => {
    const component = createComponent().componentInstance;
    expect(collectionService.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: ['ongoing', 'done', 'dropped'] }),
    );

    component.onStatusesChange(['ongoing', 'planned']);

    expect(collectionService.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: ['ongoing', 'planned'] }),
    );
  });

  it('turns a mobile status tab into a single status, or every status for All', () => {
    const component = createComponent().componentInstance;

    component.onStatusTab('done');
    expect(component.statusFilter()).toEqual(['done']);
    expect(component.activeStatusTab()).toBe('done');

    component.onStatusTab('all');
    expect(component.statusFilter()).toEqual([]);
  });

  it('filters on several media types at once', () => {
    const component = createComponent().componentInstance;

    component.filterHandlers.onMediaTypeFilterChange(['movie', 'game']);

    expect(collectionService.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ mediaType: ['movie', 'game'] }),
    );
  });

  it('toggles media types from the bar, and falls back to all once every owned type is on', () => {
    collectionService.stats.mockReturnValue(
      of({ countsByMediaType: { movie: 4, game: 2 }, total: 6, countsByStatus: {} }),
    );
    const fixture = createComponent();
    const component = fixture.componentInstance;
    const labels = () =>
      [...(fixture.nativeElement as HTMLElement).querySelectorAll('.v-lseg button')].map((button) =>
        button.textContent?.replace(/\s+/g, ' ').trim(),
      );

    expect(labels()).toEqual([
      'library.all 6',
      'collection.media_type.movie 4',
      'collection.media_type.game 2',
    ]);

    component.toggleMediaType('game');
    expect(component.mediaTypeFilter()).toEqual(['game']);
    component.toggleMediaType('movie');
    expect(component.mediaTypeFilter()).toEqual([]);

    component.toggleMediaType('movie');
    component.toggleMediaType('movie');
    expect(component.mediaTypeFilter()).toEqual([]);
    expect(component.activeFilterCount()).toBe(0);
  });

  it('keeps unrated titles when the rating range narrows, until the switch is turned off', () => {
    const component = createComponent().componentInstance;

    component.filterHandlers.onRatingRangeChange(4, 8);
    expect(collectionService.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ minRating: 4, maxRating: 8, includeUnrated: true }),
    );

    component.filterHandlers.onIncludeUnratedChange(false);
    expect(collectionService.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ minRating: 4, maxRating: 8, includeUnrated: false }),
    );
  });

  it('sorts with an explicit direction', () => {
    const component = createComponent().componentInstance;

    component.onSortBy('title');
    component.onDirection('asc');

    expect(collectionService.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: 'title', sortDirection: 'asc' }),
    );
  });

  it('opens the filter panel from the toolbar and closes it again', () => {
    const component = createComponent().componentInstance;

    component.openSheet();
    expect(component.sheetOpen()).toBe(true);

    component.sheetOpen.set(false);
    expect(component.sheetOpen()).toBe(false);
  });

  it('lights the hero with art from the shelf and states its numbers', () => {
    const base = item();
    const featured = item({
      id: 'hero',
      status: 'ongoing',
      media: {
        ...base.media,
        coverUrl: 'https://img/c.jpg',
        metadata: { backdropUrl: 'https://img/bd.jpg' },
      },
    });
    collectionService.list.mockReturnValue(
      of({ content: [featured], page: 0, size: 24, totalElements: 1 }),
    );
    collectionService.stats.mockReturnValue(
      of({ countsByMediaType: {}, total: 12, countsByStatus: { ongoing: 3 }, averageRating: 8 }),
    );
    const fixture = createComponent();
    fixture.detectChanges();
    const header = (fixture.nativeElement as HTMLElement).querySelector('header') as HTMLElement;

    expect(header.querySelector('h1')?.textContent).toContain('library.title');
    expect(header.querySelector('img')).not.toBeNull();
    expect(header.textContent?.replace(/\s+/g, ' ')).toContain('12 library.titles');
    expect(header.textContent?.replace(/\s+/g, ' ')).toContain('3 library.in_progress');
    expect(header.textContent?.replace(/\s+/g, ' ')).toContain('4 library.average');
  });

  it('an empty shelf has no backdrop and no filters', () => {
    collectionService.stats.mockReturnValue(
      of({ countsByMediaType: {}, total: 0, countsByStatus: {}, averageRating: null }),
    );
    const fixture = createComponent();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('header img')).toBeNull();
    expect(root.querySelector('shelfy-library-filters')).toBeNull();
    expect(root.querySelector('shelfy-library-sort')).toBeNull();
  });

  it('selects straight from the grid and shows the bulk bar until the selection is cleared', () => {
    collectionService.list.mockReturnValue(
      of({ content: [item(), item({ id: 'i2' })], page: 0, size: 24, totalElements: 2 }),
    );
    const fixture = createComponent();
    const component = fixture.componentInstance;
    const toolbar = () => (fixture.nativeElement as HTMLElement).querySelector('[role=toolbar]');

    expect(toolbar()).toBeNull();
    component.toggleItemSelection('i1');
    fixture.detectChanges();
    expect(component.selecting()).toBe(true);
    expect(toolbar()?.textContent).toContain('collection.bulk.select_all');

    component.toggleSelectAll();
    expect(component.selectedIds()).toEqual(new Set(['i1', 'i2']));
    component.toggleSelectAll();
    expect(component.selectedCount()).toBe(0);

    component.toggleItemSelection('i1');
    component.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.selecting()).toBe(false);
  });

  it('does not open bulk edit when no items are selected', () => {
    const fixture = createComponent();
    fixture.componentInstance.openBulkEdit();

    expect(TestBed.inject(ItemSheetService).bulk()).toBeNull();
  });

  it('opens bulk edit once items are selected', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component.toggleItemSelection('i1');
    component.openBulkEdit();

    expect(TestBed.inject(ItemSheetService).bulk()).not.toBeNull();
  });

  it('confirmBulkDelete removes the selected ids and clears the selection', () => {
    const component = createComponent().componentInstance;
    component.toggleItemSelection('i1');

    component.confirmBulkDelete();

    expect(collectionService.bulkRemove).toHaveBeenCalledWith(['i1']);
    expect(component.selecting()).toBe(false);
    expect(toastService.success).toHaveBeenCalled();
  });

  it('keeps the selection and warns when the bulk delete fails', () => {
    collectionService.bulkRemove.mockReturnValue(throwError(() => new Error('boom')));
    const component = createComponent().componentInstance;
    component.toggleItemSelection('i1');

    component.confirmBulkDelete();

    expect(toastService.error).toHaveBeenCalled();
    expect(component.selecting()).toBe(true);
  });
});
