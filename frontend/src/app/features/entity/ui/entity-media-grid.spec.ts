import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CollectionService } from '@app/core/services/collection/collection';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { buildPreviewItem } from '@app/features/discover/data-access/discover-preview.util';
import type {
  CollectionChangeEvent,
  CollectionItemResponse,
} from '@app/core/services/collection/collection.model';

import { EntityMediaGridComponent, entityItemKey } from './entity-media-grid';

describe('EntityMediaGridComponent', () => {
  let collection: {
    lookupBatch: ReturnType<typeof vi.fn>;
    changes: Subject<CollectionChangeEvent>;
    remove: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let errorMessage: { fromApiError: ReturnType<typeof vi.fn> };

  function item(overrides: Partial<CollectionItemResponse> = {}): CollectionItemResponse {
    const base = buildPreviewItem('movie', 1, 'Movie A', null, 7, null, {});
    return { ...base, ...overrides };
  }

  function create(items: CollectionItemResponse[], lookupResult: Record<string, unknown> = {}) {
    collection = {
      lookupBatch: vi.fn().mockReturnValue(of(lookupResult)),
      changes: new Subject<CollectionChangeEvent>(),
      remove: vi.fn().mockReturnValue(of(undefined)),
      create: vi.fn().mockReturnValue(of(item())),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    errorMessage = { fromApiError: vi.fn().mockReturnValue('err') };

    TestBed.configureTestingModule({
      imports: [EntityMediaGridComponent],
      providers: [
        provideRouter([]),
        { provide: CollectionService, useValue: collection },
        { provide: ToastService, useValue: toast },
        { provide: ErrorMessageService, useValue: errorMessage },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });

    const fixture = TestBed.createComponent(EntityMediaGridComponent);
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    return fixture;
  }

  it('looks up items in the collection on init', () => {
    const fixture = create([item()]);

    expect(collection.lookupBatch).toHaveBeenCalledWith([
      { provider: 'tmdb', mediaType: 'movie', externalId: '1' },
    ]);
    expect(fixture.componentInstance.displayItem(item()).status).toBe(item().status);
  });

  it('shows the shelved version of an item found by lookup', () => {
    const owned = item({ id: 'owned', status: 'done' });
    const fixture = create([item()], { 'tmdb:movie:1': owned });

    expect(fixture.componentInstance.displayItem(item()).id).toBe('owned');
  });

  it('role reads a non-empty metadata role', () => {
    const fixture = create([item({ media: { ...item().media, metadata: { role: 'Director' } } })]);
    const withRole = item({ media: { ...item().media, metadata: { role: 'Director' } } });
    expect(fixture.componentInstance.role(withRole)).toBe('Director');
    expect(fixture.componentInstance.role(item())).toBeNull();
  });

  it('renders one home card per item and forwards selection toggles', () => {
    const fixture = create([item()]);
    fixture.componentRef.setInput('selectionMode', true);
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.selectionToggle.subscribe(spy);
    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('shelfy-media-card');

    expect(cards).toHaveLength(1);
    (cards[0].querySelector('article') as HTMLElement).click();
    expect(spy).toHaveBeenCalledWith(item().media.id);
  });

  it('shows a title added through the sheet as owned', () => {
    const fixture = create([item()]);

    collection.changes.next({ type: 'created', item: item({ id: 'new-id' }) });

    expect(fixture.componentInstance.displayItem(item()).id).toBe('new-id');
  });

  it('looks items up in batches the API accepts', () => {
    const many = Array.from({ length: 236 }, (_, index) =>
      buildPreviewItem('movie', index + 1, `Movie ${index}`, null, 7, null, {}),
    );
    create(many);

    expect(collection.lookupBatch).toHaveBeenCalledTimes(2);
    expect(collection.lookupBatch.mock.calls[0][0]).toHaveLength(200);
    expect(collection.lookupBatch.mock.calls[1][0]).toHaveLength(36);
  });

  it('reports the shelved items and shows only the ones the filter keeps', () => {
    const first = buildPreviewItem('movie', 1, 'Movie A', null, 7, null, {});
    const second = buildPreviewItem('movie', 2, 'Movie B', null, 7, null, {});
    const fixture = create([first, second], { [entityItemKey(first)]: { ...first, id: 'own-1' } });
    const owned: ReadonlySet<string>[] = [];
    fixture.componentInstance.owned.subscribe((keys) => owned.push(keys));

    fixture.componentRef.setInput(
      'visible',
      (_: CollectionItemResponse, isOwned: boolean) => isOwned,
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.shownItems().map((shown) => shown.media.title)).toEqual([
      'Movie A',
    ]);

    const third = buildPreviewItem('movie', 3, 'Movie C', null, 7, null, {});
    collection.lookupBatch.mockReturnValue(
      of({ [entityItemKey(third)]: { ...third, id: 'own-3' } }),
    );
    fixture.componentRef.setInput('items', [first, second, third]);
    fixture.detectChanges();

    expect(owned.at(-1)?.has(entityItemKey(first))).toBe(true);
    expect(owned.at(-1)?.has(entityItemKey(third))).toBe(true);
  });
});
