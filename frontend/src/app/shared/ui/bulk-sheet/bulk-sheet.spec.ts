import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { TranslateService } from '@app/core/services/translate/translate';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { CollectionService } from '@app/core/services/collection/collection';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';

import { BulkSheetComponent } from './bulk-sheet';

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

describe('BulkSheetComponent', () => {
  let collectionService: {
    bulkUpdate: ReturnType<typeof vi.fn>;
    bulkRemove: ReturnType<typeof vi.fn>;
  };
  let confirm: { ask: ReturnType<typeof vi.fn> };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let errorMessage: { fromApiError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    collectionService = { bulkUpdate: vi.fn(), bulkRemove: vi.fn(() => of(undefined)) };
    confirm = { ask: vi.fn(() => Promise.resolve(true)) };
    toastService = { success: vi.fn(), error: vi.fn() };
    errorMessage = { fromApiError: vi.fn().mockReturnValue('error') };

    await TestBed.configureTestingModule({
      imports: [BulkSheetComponent],
      providers: [
        provideRouter([]),
        { provide: CollectionService, useValue: collectionService },
        { provide: ToastService, useValue: toastService },
        { provide: ErrorMessageService, useValue: errorMessage },
        { provide: ConfirmService, useValue: confirm },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(BulkSheetComponent);
    fixture.componentRef.setInput('items', [item({ id: 'i1' }), item({ id: 'i2' })]);
    fixture.componentRef.setInput('statuses', ['done', 'ongoing']);
    fixture.detectChanges();
    return fixture;
  }

  it('has no changes initially, so apply is disabled', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance.hasChanges()).toBe(false);
  });

  it('toggles a status draft on pick, and clears it when picked again', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component.pickStatus('done');
    expect(component.statusDraft()).toBe('done');
    expect(component.hasChanges()).toBe(true);

    component.pickStatus('done');
    expect(component.statusDraft()).toBeNull();
    expect(component.hasChanges()).toBe(false);
  });

  it('marks ratingTouched when the rating changes', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component.onRatingChange(7);

    expect(component.ratingTouched()).toBe(true);
    expect(component.hasChanges()).toBe(true);
  });

  it('does nothing on apply when there are no changes', () => {
    const fixture = createComponent();
    fixture.componentInstance.apply();

    expect(collectionService.bulkUpdate).not.toHaveBeenCalled();
  });

  it('applies a status change and emits the updated items', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    const updated = [item()];
    collectionService.bulkUpdate.mockReturnValue(of(updated));

    const emitted: CollectionItemResponse[][] = [];
    component.applied.subscribe((items) => emitted.push(items));

    component.pickStatus('done');
    component.apply();

    expect(collectionService.bulkUpdate).toHaveBeenCalledWith({
      ids: ['i1', 'i2'],
      status: 'done',
    });
    expect(emitted).toEqual([updated]);
    expect(component.saving()).toBe(false);
  });

  it('sends clearRating when the rating is cleared to null', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    collectionService.bulkUpdate.mockReturnValue(of([]));

    component.onRatingChange(5);
    component.onRatingChange(null);
    component.apply();

    expect(collectionService.bulkUpdate).toHaveBeenCalledWith({
      ids: ['i1', 'i2'],
      clearRating: true,
    });
  });

  it('shows a toast error when the update fails', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    collectionService.bulkUpdate.mockReturnValue(throwError(() => new Error('boom')));

    component.pickStatus('ongoing');
    component.apply();

    expect(toastService.error).toHaveBeenCalled();
    expect(component.saving()).toBe(false);
  });

  it('applies nothing until confirmed, and cancel closes without calling the API', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    component.pickStatus('done');
    component.requestClose();

    expect(component.closing()).toBe(true);
    expect(collectionService.bulkUpdate).not.toHaveBeenCalled();
  });

  it('Escape starts closing, and emits closed after the animation', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    const emitted: void[] = [];
    component.closed.subscribe(() => emitted.push(undefined));

    component.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.closing()).toBe(true);

    const aside = fixture.nativeElement.querySelector('aside') as HTMLElement;
    aside.dispatchEvent(new Event('animationend'));
    expect(emitted.length).toBe(1);
  });

  it('fans out at most 3 covers', () => {
    const fixture = TestBed.createComponent(BulkSheetComponent);
    const items = Array.from({ length: 6 }, (_, n) =>
      item({ id: 'i' + n, media: { ...item().media, coverUrl: 'c' + n } }),
    );
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    expect(fixture.componentInstance.covers().length).toBe(3);
  });

  it('shows the shared status with how many titles have it, and mixed ratings', () => {
    const fixture = TestBed.createComponent(BulkSheetComponent);
    fixture.componentRef.setInput('items', [
      item({ id: 'i1', rating: 8 }),
      item({ id: 'i2', rating: 6 }),
    ]);
    fixture.componentRef.setInput('statuses', ['planned', 'ongoing', 'done', 'dropped']);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.shownStatus()).toBe('done');
    expect(component.statusDetail()).toBe('library.bulk.of_total');
    expect(component.mixedRatings()).toBe(true);
    expect(component.ratingLabel()).toBe('library.bulk.mixed');
  });

  it('deletes every selected title once confirmed', async () => {
    const fixture = createComponent();

    await fixture.componentInstance.deleteAll();

    expect(confirm.ask).toHaveBeenCalled();
    expect(collectionService.bulkRemove).toHaveBeenCalledWith(['i1', 'i2']);
    expect(fixture.componentInstance.closing()).toBe(true);
  });
});
