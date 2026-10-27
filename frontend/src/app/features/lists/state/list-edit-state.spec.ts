import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import type { MediaResponse } from '@app/core/services/collection/collection.model';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ListsService } from '@app/core/services/lists/lists';
import type { MediaListResponse } from '@app/core/services/lists/lists.model';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { createListEditState, MAX_TAGS, planMove } from './list-edit-state';

const media = (id: string): MediaResponse => ({ id, title: `Title ${id}` }) as MediaResponse;

function list(overrides: Partial<MediaListResponse> = {}): MediaListResponse {
  const ids = ['a', 'b', 'c', 'd'];
  return {
    id: 'l1',
    name: 'Best of',
    description: null,
    visibility: 'private',
    tags: ['scifi'],
    updatedAt: '2024-01-01',
    media: ids.map(media),
    items: ids.map((mediaId) => ({ mediaId, addedBy: null })),
    ...overrides,
  } as MediaListResponse;
}

describe('planMove', () => {
  const items = ['a', 'b', 'c', 'd'].map(media);
  const order = (result: MediaResponse[] | null) => result?.map((m) => m.id);

  it('moves a block to the top or the bottom', () => {
    expect(order(planMove(items, ['c'], 'top'))).toEqual(['c', 'a', 'b', 'd']);
    expect(order(planMove(items, ['b'], 'bottom'))).toEqual(['a', 'c', 'd', 'b']);
  });

  it('moves a title one step up or down', () => {
    expect(order(planMove(items, ['c'], 'up'))).toEqual(['a', 'c', 'b', 'd']);
    expect(order(planMove(items, ['b'], 'down'))).toEqual(['a', 'c', 'b', 'd']);
  });

  it('plans nothing when nothing would change or the title is unknown', () => {
    expect(planMove(items, ['a'], 'top')).toBeNull();
    expect(planMove(items, ['x'], 'top')).toBeNull();
  });
});

describe('createListEditState', () => {
  let lists: Record<
    'updateDetails' | 'addItems' | 'removeItems' | 'reorder' | 'get',
    ReturnType<typeof vi.fn>
  >;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let confirm: { ask: ReturnType<typeof vi.fn> };
  let source: ReturnType<typeof signal<MediaListResponse | null>>;

  function setup(initial: MediaListResponse | null = list()) {
    vi.useFakeTimers();
    lists = {
      updateDetails: vi.fn().mockImplementation((_id, body) => of(list({ ...body }))),
      addItems: vi.fn().mockReturnValue(of(list())),
      removeItems: vi.fn().mockReturnValue(of(list({ media: [media('a')], items: [] }))),
      reorder: vi.fn().mockReturnValue(of(list())),
      get: vi.fn().mockReturnValue(of(list())),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    confirm = { ask: vi.fn().mockResolvedValue(true) };
    source = signal(initial);
    TestBed.configureTestingModule({
      providers: [
        { provide: ListsService, useValue: lists },
        { provide: ConfirmService, useValue: confirm },
        { provide: ToastService, useValue: toast },
        { provide: ErrorMessageService, useValue: { fromApiError: () => 'failed' } },
        { provide: TranslateService, useValue: { get: (key: string) => key } },
      ],
    });
    const state = TestBed.runInInjectionContext(() => createListEditState(source));
    TestBed.tick();
    return state;
  }

  afterEach(() => vi.useRealTimers());

  it('fills the fields from the list that was loaded', () => {
    const state = setup();

    expect(state.name()).toBe('Best of');
    expect(state.tags()).toEqual(['scifi']);
    expect(state.media().map((m) => m.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('saves the details a moment after the owner stops typing', async () => {
    const state = setup();

    state.name.set('Top picks');
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(300);
    expect(lists.updateDetails).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);

    expect(lists.updateDetails).toHaveBeenCalledWith(
      'l1',
      expect.objectContaining({ name: 'Top picks', visibility: 'private' }),
    );
    expect(state.detailsState()).toBe('saved');
  });

  it('does not save an empty name', async () => {
    const state = setup();

    state.name.set('   ');
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(2000);

    expect(lists.updateDetails).not.toHaveBeenCalled();
    expect(state.nameValid()).toBe(false);
  });

  it('flags a failed save and tells the user', async () => {
    const state = setup();
    lists.updateDetails.mockReturnValue(throwError(() => new Error('boom')));

    state.name.set('Top picks');
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(800);

    expect(state.detailsState()).toBe('error');
    expect(state.hasUnsaved()).toBe(true);
    expect(toast.error).toHaveBeenCalledWith('failed');
  });

  it('publishes with the chosen visibility right away', () => {
    const state = setup();

    state.publish('public');

    expect(lists.updateDetails).toHaveBeenCalledWith(
      'l1',
      expect.objectContaining({ visibility: 'public' }),
    );
  });

  it('sends pending edits when the page goes away', () => {
    const state = setup();
    state.name.set('Last minute');

    state.flush();

    expect(lists.updateDetails).toHaveBeenCalledTimes(1);
  });

  it('accepts a tag once, trimmed, up to the limit', () => {
    const state = setup();

    expect(state.addTag('  space ')).toBe(true);
    expect(state.addTag('space')).toBe(false);
    expect(state.addTag('   ')).toBe(false);
    expect(state.addTag('x'.repeat(101))).toBe(false);
    for (let i = 0; i < MAX_TAGS; i++) state.addTag(`tag${i}`);
    expect(state.tags()).toHaveLength(MAX_TAGS);
    state.removeTag('space');
    expect(state.tags()).not.toContain('space');
  });

  it('adds titles through the queue', () => {
    const state = setup();

    state.add([{ provider: 'tmdb', mediaType: 'movie', externalId: '1', title: 'x' } as never]);

    expect(lists.addItems).toHaveBeenCalledWith('l1', [
      { provider: 'tmdb', mediaType: 'movie', externalId: '1' },
    ]);
  });

  describe('removal', () => {
    it('hides titles at once and only deletes them after the undo window', async () => {
      const state = setup();

      await state.remove(['b', 'c']);

      expect(state.media().map((m) => m.id)).toEqual(['a', 'd']);
      expect(toast.success).toHaveBeenCalledWith(
        'lists.manage.removed_titles',
        expect.any(Number),
        expect.objectContaining({ run: expect.any(Function) }),
      );
      expect(lists.removeItems).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(5100);
      expect(lists.removeItems).toHaveBeenCalledWith('l1', ['b', 'c']);
    });

    it('brings titles back when the user undoes', async () => {
      const state = setup();
      await state.remove(['b']);

      toast.success.mock.calls[0][2].run();
      await vi.advanceTimersByTimeAsync(6000);

      expect(state.media()).toHaveLength(4);
      expect(lists.removeItems).not.toHaveBeenCalled();
    });

    it('names the title when only one is removed', async () => {
      const state = setup();

      await state.remove(['b']);

      expect(toast.success.mock.calls[0][0]).toBe('lists.manage.removed_title');
    });

    it('shows the titles again and reports the error when the deletion fails', async () => {
      const state = setup();
      lists.removeItems.mockReturnValue(throwError(() => new Error('boom')));

      await state.remove(['b']);
      await vi.advanceTimersByTimeAsync(5100);

      expect(toast.error).toHaveBeenCalledWith('failed');
      expect(state.media()).toHaveLength(4);
    });

    it('asks before removing and keeps the titles when the user cancels', async () => {
      const state = setup();
      confirm.ask.mockResolvedValue(false);

      await state.remove(['b']);

      expect(confirm.ask).toHaveBeenCalledWith(
        'lists.manage.confirm_remove_one',
        expect.objectContaining({ destructive: true }),
      );
      expect(state.media()).toHaveLength(4);
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('takes removed titles out of the selection', async () => {
      const state = setup();
      state.toggleSelectionMode();
      state.selectAll(['a', 'b']);

      await state.remove(['b']);

      expect([...state.selected()]).toEqual(['a']);
    });
  });

  describe('move', () => {
    it('reorders at once and tells the server the new order', () => {
      const state = setup();
      const answer = new Subject<MediaListResponse>();
      lists.reorder.mockReturnValue(answer);

      state.move(['c'], 'top');

      expect(source()!.media.map((m) => m.id)).toEqual(['c', 'a', 'b', 'd']);
      expect(lists.reorder).toHaveBeenCalledWith('l1', ['c', 'a', 'b', 'd']);
      answer.next(list({ media: ['c', 'a', 'b', 'd'].map(media) }));
      expect(source()!.media.map((m) => m.id)).toEqual(['c', 'a', 'b', 'd']);
    });

    it('does nothing when the order would not change', () => {
      const state = setup();

      state.move(['a'], 'top');

      expect(lists.reorder).not.toHaveBeenCalled();
    });

    it('reloads the real list when the server refuses', () => {
      const state = setup();
      lists.reorder.mockReturnValue(throwError(() => new Error('boom')));

      state.move(['c'], 'top');

      expect(toast.error).toHaveBeenCalledWith('failed');
      expect(lists.get).toHaveBeenCalledWith('l1');
    });
  });

  it('clears the selection and the pending removal when another list is opened', async () => {
    const state = setup();
    state.toggleSelectionMode();
    state.selectAll(['a']);
    await state.remove(['b']);

    source.set(list({ id: 'l2', name: 'Other' }));
    TestBed.tick();

    expect(state.selectionMode()).toBe(false);
    expect(state.name()).toBe('Other');
    expect(state.media()).toHaveLength(4);
  });
});
