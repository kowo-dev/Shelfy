import { Location } from '@angular/common';
import { of } from 'rxjs';
import { Component, input, output } from '@angular/core';
import { vi } from 'vitest';

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { AuthService } from '@app/core/services/auth/auth';
import { CollectionService } from '@app/core/services/collection/collection';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { WatchLogService } from '@app/core/services/watch-log/watch-log';
import type { WatchLogEntry } from '@app/core/services/watch-log/watch-log.model';
import { RichTextEditorComponent } from '@shared/ui/rich-text/rich-text-editor';

import { ReviewStudioPageComponent } from './review-studio';

const words = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

function item(overrides: Partial<CollectionItemResponse> = {}): CollectionItemResponse {
  return {
    id: 'item-1',
    userId: 'u1',
    media: { title: 'Elden Ring', mediaType: 'game', coverUrl: null } as never,
    status: 'done',
    rating: 8,
    note: words('Old note'),
    containsSpoilers: false,
    progress: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function viewing(overrides: Partial<WatchLogEntry> = {}): WatchLogEntry {
  return {
    id: 'log-1',
    occurredAt: '2025-03-14',
    isRewatch: false,
    name: null,
    rating: 6,
    review: words('First time through'),
    containsSpoilers: true,
    source: 'manual',
    createdAt: '2025-03-14T00:00:00Z',
    ...overrides,
  };
}

@Component({ selector: 'shelfy-rich-text-editor', template: '' })
class EditorStubComponent {
  readonly placeholder = input('');
  readonly content = input<unknown>(null);
  readonly contentChange = output<unknown>();
}

describe('ReviewStudioPageComponent', () => {
  function setup(
    params: Record<string, string>,
    query: Record<string, string> = {},
    owned: CollectionItemResponse | null = null,
    render = false,
    openedInApp = false,
    data: Record<string, string> = {},
    entries: WatchLogEntry[] = [],
  ) {
    const collection = {
      lookup: vi.fn().mockReturnValue(of(owned)),
      getItem: vi.fn().mockReturnValue(of(item())),
      create: vi.fn().mockReturnValue(of(item({ id: 'item-2', note: null }))),
      update: vi.fn().mockImplementation((id: string) => of(item({ id }))),
      refreshItem: vi.fn().mockImplementation((id: string) => of(item({ id }))),
    };
    const watchLog = {
      list: vi.fn().mockReturnValue(of(entries)),
      create: vi.fn().mockReturnValue(of(viewing())),
      update: vi.fn().mockReturnValue(of(viewing())),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };
    const router = {
      navigate: vi.fn(),
      navigateByUrl: vi.fn(),
      currentNavigation: () => (openedInApp ? { previousNavigation: {} } : null),
    };
    const location = { back: vi.fn() };
    TestBed.configureTestingModule({
      imports: [ReviewStudioPageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap(params),
              queryParamMap: convertToParamMap(query),
              data,
            },
          },
        },
        { provide: Router, useValue: router },
        { provide: Location, useValue: location },
        { provide: CollectionService, useValue: collection },
        { provide: WatchLogService, useValue: watchLog },
        {
          provide: AuthService,
          useValue: { currentUser: () => ({ profileVisibility: 'private' }) },
        },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: ErrorMessageService, useValue: { fromApiError: () => 'error' } },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    if (render) {
      TestBed.overrideComponent(ReviewStudioPageComponent, {
        remove: { imports: [RichTextEditorComponent] },
        add: { imports: [EditorStubComponent] },
      });
    } else {
      TestBed.overrideComponent(ReviewStudioPageComponent, { set: { template: '' } });
    }
    const fixture = TestBed.createComponent(ReviewStudioPageComponent);
    fixture.detectChanges();
    return { page: fixture.componentInstance, collection, watchLog, router, location, fixture };
  }

  const newReview = {
    provider: 'igdb',
    mediaType: 'game',
    externalId: '42',
    title: 'Elden Ring',
  };

  it('starts a new review for a title that is not on the shelf yet', () => {
    const { page, collection } = setup({}, newReview);

    expect(collection.lookup).toHaveBeenCalledWith('igdb', 'game', '42');
    expect(page.isNew()).toBe(true);
    expect(page.title()).toBe('Elden Ring');
    expect(page.visibilityKey()).toBe('studio.visibility.private');
  });

  it('sends a title already on the shelf to its edit page', () => {
    const { router } = setup({}, newReview, item());

    expect(router.navigate).toHaveBeenCalledWith(['/reviews', 'item-1', 'edit'], {
      replaceUrl: true,
    });
  });

  it('publishes by shelving the title, then saving the text and the rating', () => {
    const { page, collection, router } = setup({}, newReview);
    page.onContent(words('A slow burn that pays off.'));
    page.onRating(9);
    page.status.set('ongoing');

    page.finish();

    expect(collection.create).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: '42', status: 'ongoing', rating: 9 }),
    );
    expect(collection.update).toHaveBeenCalledWith(
      'item-2',
      expect.objectContaining({ note: words('A slow burn that pays off.'), rating: 9 }),
    );
    expect(router.navigate).toHaveBeenCalledWith(['/reviews', 'item-2'], { replaceUrl: true });
  });

  it('will not publish an empty review', () => {
    const { page, collection } = setup({}, newReview);

    page.finish();

    expect(collection.create).not.toHaveBeenCalled();
  });

  it('returns to the page it was opened from when done', () => {
    const { page, router, location } = setup({ id: 'item-1' }, {}, null, false, true);

    page.onSpoiler(true);
    page.finish();

    expect(location.back).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('edits an existing review in place and goes back to it when done', () => {
    const { page, collection, router } = setup({ id: 'item-1' });
    expect(collection.getItem).toHaveBeenCalledWith('item-1');
    expect(page.isNew()).toBe(false);
    expect(page.rating()).toBe(8);

    page.onSpoiler(true);
    page.finish();

    expect(collection.update).toHaveBeenCalledWith(
      'item-1',
      expect.objectContaining({ containsSpoilers: true }),
    );
    expect(router.navigate).toHaveBeenCalledWith(['/reviews', 'item-1'], { replaceUrl: true });
  });

  it('shows the status, the rating and the publish bar for a new review', () => {
    const { fixture } = setup({}, newReview, null, true);
    const host: HTMLElement = fixture.nativeElement;
    const buttons = Array.from(host.querySelectorAll('button')).map((b) => b.textContent ?? '');

    expect(host.querySelector('shelfy-rating-block')).not.toBeNull();
    expect(host.querySelector('shelfy-status-picker')).not.toBeNull();
    expect(buttons.some((text) => text.includes('studio.publish'))).toBe(true);
  });

  it('keeps the status out when editing an existing review', () => {
    const { fixture } = setup({ id: 'item-1' }, {}, null, true);
    const host: HTMLElement = fixture.nativeElement;

    expect(host.querySelector('shelfy-rating-block')).not.toBeNull();
    expect(host.querySelector('shelfy-status-picker')).toBeNull();
  });

  const logMode = { studio: 'log' };

  it('logs a new viewing as a rewatch once the title has history, with its own rating and text', () => {
    const { page, watchLog, collection, router } = setup(
      { id: 'item-1' },
      {},
      null,
      false,
      false,
      logMode,
      [viewing()],
    );
    expect(page.logRepeat()).toBe(true);
    expect(page.rating()).toBeNull();
    expect(page.canFinish()).toBe(true);

    page.onLogDate('2026-10-20');
    page.onRating(9);
    page.onContent(words('Better the second time'));
    expect(page.hasUnsavedChanges()).toBe(true);
    page.finish();

    expect(watchLog.create).toHaveBeenCalledWith('item-1', {
      occurredAt: '2026-10-20',
      isRewatch: true,
      name: null,
      rating: 9,
      review: words('Better the second time'),
      containsSpoilers: false,
    });
    expect(collection.update).not.toHaveBeenCalled();
    expect(collection.refreshItem).toHaveBeenCalledWith('item-1');
    expect(router.navigate).toHaveBeenCalledWith(['/reviews', 'item-1'], { replaceUrl: true });
  });

  it('edits a past viewing with its own values and deletes it after a confirmation', () => {
    const { page, watchLog } = setup(
      { id: 'item-1', logId: 'log-1' },
      {},
      null,
      false,
      false,
      logMode,
      [viewing()],
    );
    expect(page.logDate()).toBe('2025-03-14');
    expect(page.rating()).toBe(6);
    expect(page.spoiler()).toBe(true);

    page.deleteLog();
    expect(watchLog.delete).not.toHaveBeenCalled();
    page.deleteLog();
    expect(watchLog.delete).toHaveBeenCalledWith('item-1', 'log-1');
  });

  it('will not log a viewing without a valid date', () => {
    const { page, watchLog } = setup({ id: 'item-1' }, {}, null, false, false, logMode);

    page.onLogDate('');
    page.finish();

    expect(page.canFinish()).toBe(false);
    expect(watchLog.create).not.toHaveBeenCalled();
  });

  it('shows the date and the rewatch box instead of the status in viewing mode', () => {
    const { fixture } = setup({ id: 'item-1' }, {}, null, true, false, logMode);
    const host: HTMLElement = fixture.nativeElement;

    expect(host.querySelector('shelfy-input')).not.toBeNull();
    expect(host.querySelector('#studio-repeat')).not.toBeNull();
    expect(host.querySelector('shelfy-status-picker')).toBeNull();
  });
});
