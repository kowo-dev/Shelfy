import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { VersusService } from '@app/core/services/versus/versus';
import type { VersusEntry, VersusPoolResponse } from '@app/core/services/versus/versus.model';
import { createVersusEditState, MIN_VERSUS_ENTRIES } from './versus-edit-state';

const entry = (id: string, overrides: Partial<VersusEntry> = {}): VersusEntry => ({
  id,
  title: `Entry ${id}`,
  coverUrl: null,
  media: null,
  clip: null,
  addedBy: { userId: 'u1' } as never,
  ...overrides,
});

function pool(overrides: Partial<VersusPoolResponse> = {}): VersusPoolResponse {
  return {
    id: 'p1',
    name: 'Openings',
    description: null,
    visibility: 'private',
    isOwner: true,
    updatedAt: '2024-01-01',
    entries: ['a', 'b', 'c', 'd'].map((id) => entry(id)),
    collaborators: [],
    ...overrides,
  } as VersusPoolResponse;
}

describe('createVersusEditState', () => {
  let versus: Record<
    'updatePool' | 'addItems' | 'addClip' | 'updateClip' | 'removeItems',
    ReturnType<typeof vi.fn>
  >;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  function setup(initial: VersusPoolResponse | null = pool()) {
    vi.useFakeTimers();
    versus = {
      updatePool: vi.fn().mockImplementation((_id, body) => of(pool({ ...body }))),
      addItems: vi.fn().mockReturnValue(of(pool())),
      addClip: vi.fn().mockReturnValue(of(pool())),
      updateClip: vi.fn().mockReturnValue(of(pool())),
      removeItems: vi.fn().mockReturnValue(of(pool())),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    const source = signal(initial);
    TestBed.configureTestingModule({
      providers: [
        { provide: VersusService, useValue: versus },
        { provide: ConfirmService, useValue: { ask: vi.fn().mockResolvedValue(true) } },
        { provide: ToastService, useValue: toast },
        { provide: ErrorMessageService, useValue: { fromApiError: () => 'failed' } },
        { provide: TranslateService, useValue: { get: (key: string) => key } },
      ],
    });
    const state = TestBed.runInInjectionContext(() => createVersusEditState(source));
    TestBed.tick();
    return { state, source };
  }

  afterEach(() => vi.useRealTimers());

  it('fills the fields from the pool and counts the entries', () => {
    const { state } = setup();

    expect(state.name()).toBe('Openings');
    expect(state.entries()).toHaveLength(4);
    expect(state.enoughEntries()).toBe(4 >= MIN_VERSUS_ENTRIES);
  });

  it('is not ready to play with too few entries', () => {
    const { state } = setup(pool({ entries: [entry('a')] }));

    expect(state.enoughEntries()).toBe(false);
  });

  it('tells clips from media', () => {
    expect(setup().state.kind()).toBe('media');
    TestBed.resetTestingModule();

    const clips = setup(pool({ entries: [entry('a', { clip: { title: 'x' } as never })] }));
    expect(clips.state.kind()).toBe('clips');
    TestBed.resetTestingModule();

    expect(setup(pool({ entries: [] })).state.kind()).toBeNull();
  });

  it('shows authors only when several people added entries or there are collaborators', () => {
    expect(setup().state.showAuthors()).toBe(false);
    TestBed.resetTestingModule();

    const mixed = setup(
      pool({ entries: [entry('a'), entry('b', { addedBy: { userId: 'u2' } as never })] }),
    );
    expect(mixed.state.showAuthors()).toBe(true);
    TestBed.resetTestingModule();

    expect(setup(pool({ collaborators: [{} as never] })).state.showAuthors()).toBe(true);
  });

  it('autosaves the details only for the owner', async () => {
    const owner = setup();
    owner.state.name.set('New name');
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(800);
    expect(versus.updatePool).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ name: 'New name' }),
    );
    TestBed.resetTestingModule();

    const visitor = setup(pool({ isOwner: false }));
    visitor.state.name.set('Hijacked');
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(2000);
    expect(versus.updatePool).not.toHaveBeenCalled();
  });

  it('adds media and clips through the queue and updates a clip', () => {
    const { state } = setup();

    state.addMedia([
      { provider: 'tmdb', mediaType: 'movie', externalId: '1', title: 'x' } as never,
    ]);
    state.addClip({ url: 'https://youtu.be/abc' });
    state.updateClip('a', { startSeconds: 4, linkedMedia: null });

    expect(versus.addItems).toHaveBeenCalledWith('p1', [
      { provider: 'tmdb', mediaType: 'movie', externalId: '1' },
    ]);
    expect(versus.addClip).toHaveBeenCalledWith('p1', { url: 'https://youtu.be/abc' });
    expect(versus.updateClip).toHaveBeenCalledWith('p1', 'a', {
      startSeconds: 4,
      linkedMedia: null,
    });
  });

  it('removes entries after the undo window with the versus wording', async () => {
    const { state } = setup();

    await state.remove(['a', 'b']);

    expect(state.entries().map((e) => e.id)).toEqual(['c', 'd']);
    expect(toast.success.mock.calls[0][0]).toBe('versus.manage.removed_many');
    await vi.advanceTimersByTimeAsync(5100);
    expect(versus.removeItems).toHaveBeenCalledWith('p1', ['a', 'b']);
  });

  it('ignores an empty add or removal', async () => {
    const { state } = setup();

    state.addMedia([]);
    await state.remove([]);

    expect(versus.addItems).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
