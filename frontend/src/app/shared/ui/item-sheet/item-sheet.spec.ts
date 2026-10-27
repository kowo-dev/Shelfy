import { By } from '@angular/platform-browser';
import { RatingBlockComponent } from '@shared/ui/rating-block/rating-block';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '@app/core/services/auth/auth';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import { ListsService } from '@app/core/services/lists/lists';
import { EpisodeProgressService } from '@app/core/services/episode-progress/episode-progress';
import { CollectionService } from '@app/core/services/collection/collection';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { TranslateService } from '@app/core/services/translate/translate';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import type {
  CollectionItemResponse,
  MediaResponse,
} from '@app/core/services/collection/collection.model';

import { ItemSheetComponent } from './item-sheet';

function media(overrides: Partial<MediaResponse> = {}): MediaResponse {
  return {
    id: 'm1',
    canonicalWorkId: 'c1',
    externalId: 'e1',
    provider: 'tmdb',
    mediaType: 'movie',
    title: 'Dune',
    coverUrl: null,
    metadata: null,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function item(overrides: Partial<CollectionItemResponse> = {}): CollectionItemResponse {
  return {
    id: 'i1',
    userId: 'u1',
    media: media(),
    status: 'planned',
    rating: null,
    note: null,
    containsSpoilers: false,
    progress: {},
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('ItemSheetComponent', () => {
  let update: ReturnType<typeof vi.fn>;
  let remove: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let toastSuccess: ReturnType<typeof vi.fn>;
  let toastError: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    update = vi.fn().mockReturnValue(of(item()));
    remove = vi.fn().mockReturnValue(of(undefined));
    navigate = vi.fn();
    toastSuccess = vi.fn();
    toastError = vi.fn();

    await TestBed.configureTestingModule({
      imports: [ItemSheetComponent],
      providers: [
        { provide: CollectionService, useValue: { update, remove } },
        { provide: ToastService, useValue: { success: toastSuccess, error: toastError } },
        {
          provide: ErrorMessageService,
          useValue: { fromApiError: (e: unknown) => (e instanceof Error ? e.message : 'error') },
        },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
        {
          provide: DateFormatService,
          useValue: { formatDate: () => 'Jan 1', formatRelative: () => '2 yr. ago' },
        },
        { provide: Router, useValue: { navigate } },
        {
          provide: AuthService,
          useValue: { currentUser: () => ({ profileVisibility: 'private' }) },
        },
        { provide: ListsService, useValue: { editable: () => of([]) } },
        {
          provide: EpisodeProgressService,
          useValue: {
            get: () =>
              of({
                seasons: [{ season: 1, total: 3, watched: [1], ratings: {} }],
                isCompleted: false,
                status: 'ongoing',
              }),
            update: vi.fn(),
          },
        },
      ],
    }).compileComponents();
  });

  function createComponent(value: CollectionItemResponse) {
    const fixture = TestBed.createComponent(ItemSheetComponent);
    fixture.componentRef.setInput('item', value);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the media title', () => {
    const fixture = createComponent(item());
    expect(fixture.nativeElement.textContent).toContain('Dune');
  });

  it('saves a status change immediately and shows it before the server answers', () => {
    const updated = item({ id: 'i1', status: 'done' });
    update.mockReturnValue(of(updated));
    const fixture = createComponent(item({ id: 'i1', status: 'planned' }));
    const component = fixture.componentInstance;
    const emitted: CollectionItemResponse[] = [];
    component.updated.subscribe((v) => emitted.push(v));

    component.pickStatus('done');

    expect(update).toHaveBeenCalledWith('i1', { status: 'done' });
    expect(component.data().status).toBe('done');
    expect(emitted).toEqual([updated]);
  });

  it('saves ratings and clears them', () => {
    update.mockReturnValue(of(item({ id: 'i1', rating: 9, status: 'ongoing' })));
    const fixture = createComponent(item({ id: 'i1', rating: 6, status: 'ongoing' }));
    const component = fixture.componentInstance;

    component.changeRating(9);
    expect(update).toHaveBeenCalledWith('i1', { rating: 9 });

    update.mockClear();
    component.changeRating(null);
    expect(update).toHaveBeenCalledWith('i1', { clearRating: true });
  });

  it('marks a planned title done when I rate it', () => {
    update.mockReturnValue(of(item({ id: 'i1', rating: 8, status: 'done' })));
    const fixture = createComponent(item({ id: 'i1', status: 'planned' }));

    fixture.componentInstance.changeRating(8);

    expect(update).toHaveBeenCalledWith('i1', { rating: 8, status: 'done' });
  });

  it('openMediaDetail() navigates to the media page', () => {
    const fixture = createComponent(
      item({ media: media({ mediaType: 'movie', externalId: '42' }) }),
    );
    fixture.componentInstance.openMediaDetail();

    expect(navigate).toHaveBeenCalledWith(['/media', 'movie', '42']);
  });

  it('rolls back and shows an error toast when saving fails', () => {
    update.mockReturnValue(throwError(() => new Error('save failed')));
    const fixture = createComponent(item({ id: 'i1', status: 'planned' }));

    fixture.componentInstance.pickStatus('done');

    expect(toastError).toHaveBeenCalledWith('save failed');
    expect(fixture.componentInstance.data().status).toBe('planned');
    expect(fixture.componentInstance.saving()).toBe(0);
  });

  function buttonByText(root: HTMLElement, text: string): HTMLButtonElement {
    return [...root.querySelectorAll('button')].find(
      (b) => b.textContent?.includes(text) || b.getAttribute('aria-label')?.includes(text),
    ) as HTMLButtonElement;
  }

  it('saves without a success toast and says Saved in the header instead', () => {
    update.mockReturnValue(of(item({ id: 'i1', status: 'done' })));
    const fixture = createComponent(item({ id: 'i1', status: 'ongoing' }));

    fixture.componentInstance.pickStatus('done');
    fixture.detectChanges();

    expect(toastSuccess).not.toHaveBeenCalled();
    expect(fixture.componentInstance.saveState()).toBe('saved');
    expect(fixture.nativeElement.querySelector('header')?.textContent).toContain(
      'collection.sheet.saved',
    );
  });

  it('has no Done button, offers review and removal, and no removal on a draft', () => {
    const root = createComponent(item({ status: 'ongoing' })).nativeElement as HTMLElement;
    expect(buttonByText(root, 'collection.sheet.write_review')).toBeDefined();
    expect(buttonByText(root, 'collection.sheet.done')).toBeUndefined();
    expect(buttonByText(root, 'collection.sheet.remove')).toBeDefined();

    const fixture = createComponent(item());
    fixture.componentRef.setInput('draft', true);
    fixture.detectChanges();
    expect(buttonByText(fixture.nativeElement, 'collection.sheet.remove')).toBeUndefined();
  });

  it('shows a backlog title on its Backlog tile and removes it from the backlog', () => {
    const root = createComponent(item({ status: 'planned' })).nativeElement as HTMLElement;

    expect(buttonByText(root, 'collection.sheet.remove_backlog')).toBeDefined();
    expect(root.querySelector('shelfy-status-picker [aria-checked=true]')?.textContent).toContain(
      'collection.status.planned',
    );
  });

  it('offers review and log as labelled buttons, with no menu', () => {
    const fixture = createComponent(item({ status: 'ongoing' }));
    const root = fixture.nativeElement as HTMLElement;

    for (const key of ['collection.sheet.write_review', 'collection.sheet.log_viewing']) {
      expect(buttonByText(root, key)).toBeDefined();
    }
    expect(root.querySelector('[aria-haspopup=menu]')).toBeNull();
  });

  it('says Edit review once there is a review', () => {
    const note = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rewatched it twice.' }] }],
    };
    const root = createComponent(item({ note })).nativeElement as HTMLElement;

    expect(buttonByText(root, 'collection.sheet.edit_review')).toBeDefined();
  });

  it('shows the rating with its verdict and previews a hovered star', () => {
    const fixture = createComponent(item({ rating: 9 }));
    const editor = fixture.debugElement.query(By.directive(RatingBlockComponent))
      .componentInstance as RatingBlockComponent;
    expect(editor.ratingText()).toBe('4.5');
    expect(editor.verdictKey()).toBe('collection.verdict.amazing');

    editor.preview.set(4);
    expect(editor.ratingText()).toBe('2');
  });

  it('opens the media page from the cover', () => {
    const fixture = createComponent(item({ media: media({ externalId: '42' }) }));

    buttonByText(fixture.nativeElement, 'media.view_details').click();

    expect(navigate).toHaveBeenCalledWith(['/media', 'movie', '42']);
  });

  it('asks for confirmation before removing', () => {
    const ask = vi.spyOn(TestBed.inject(ConfirmService), 'choose').mockResolvedValue('cancel');
    const fixture = createComponent(item());

    buttonByText(fixture.nativeElement, 'collection.sheet.remove').click();

    expect(ask).toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('opens the review editor page from the review action instead of writing in the sheet', () => {
    const fixture = createComponent(item({ id: 'i1', status: 'done' }));
    const root = fixture.nativeElement as HTMLElement;

    buttonByText(root, 'collection.sheet.write_review').click();

    expect(fixture.componentInstance.closing()).toBe(true);
    expect(navigate).toHaveBeenCalledWith(['/reviews', 'i1', 'edit']);
  });

  it('opens the studio in viewing mode from the log action', () => {
    const fixture = createComponent(item({ id: 'i1', status: 'done' }));
    const root = fixture.nativeElement as HTMLElement;

    buttonByText(root, 'collection.sheet.log_viewing').click();

    expect(fixture.componentInstance.closing()).toBe(true);
    expect(navigate).toHaveBeenCalledWith(['/reviews', 'i1', 'log']);
  });

  it('closes everything when the removal dialog is dismissed', async () => {
    vi.spyOn(TestBed.inject(ConfirmService), 'choose').mockResolvedValue('dismiss');
    const fixture = createComponent(item());
    const component = fixture.componentInstance;

    await component.deleteItem();

    expect(remove).not.toHaveBeenCalled();
    expect(component.closing()).toBe(true);
    expect(component.hidden()).toBe(true);
  });

  it('asks for the removal alone and comes back when cancelled', async () => {
    const ask = vi.spyOn(TestBed.inject(ConfirmService), 'choose').mockResolvedValue('cancel');
    const fixture = createComponent(item());
    const component = fixture.componentInstance;

    const pending = component.deleteItem();
    expect(component.hidden()).toBe(true);
    await pending;

    expect(ask).toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(component.hidden()).toBe(false);
  });

  it('deletes and stays closed when the removal is confirmed', async () => {
    vi.spyOn(TestBed.inject(ConfirmService), 'choose').mockResolvedValue('confirm');
    const fixture = createComponent(item({ id: 'i1' }));
    const component = fixture.componentInstance;

    await component.deleteItem();

    expect(remove).toHaveBeenCalledWith('i1');
    expect(toastSuccess).toHaveBeenCalled();
    expect(component.hidden()).toBe(true);
    expect(component.closing()).toBe(true);
  });

  it('lists one tile per progress status, then the Backlog tile', () => {
    const fixture = createComponent(item({ id: 'i1', status: 'done' }));
    const root = fixture.nativeElement as HTMLElement;
    const tiles = [...root.querySelectorAll('shelfy-status-picker [role=radio]')];

    expect(tiles.length).toBe(4);
    expect(tiles[3].textContent).toContain('collection.status.planned');
    expect(root.querySelector('shelfy-status-picker [aria-checked=true]')?.textContent).toContain(
      'collection.status_done.watched',
    );

    (tiles[3] as HTMLButtonElement).click();
    expect(update).toHaveBeenCalledWith('i1', { status: 'planned' });
  });

  it('shows the cover in the header', () => {
    const fixture = createComponent(item({ media: media({ coverUrl: '/c.jpg' }) }));

    expect(fixture.nativeElement.querySelector('header img')).not.toBeNull();
  });

  it('Escape starts the closing animation', () => {
    const fixture = createComponent(item());
    fixture.componentInstance.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(fixture.componentInstance.closing()).toBe(true);
  });
});
