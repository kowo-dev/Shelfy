import { of } from 'rxjs';
import { vi } from 'vitest';

import { TestBed } from '@angular/core/testing';
import { convertToParamMap } from '@angular/router';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { VersusService } from '@app/core/services/versus/versus';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { TranslateService } from '@app/core/services/translate/translate';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { AuthService } from '@app/core/services/auth/auth';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import { PeopleService } from '@app/core/services/people/people';
import type { VersusPoolResponse } from '@app/core/services/versus/versus.model';

import { VersusPoolDetailPageComponent } from './versus-pool-detail';

function poolResponse(overrides: Partial<VersusPoolResponse> = {}): VersusPoolResponse {
  return {
    id: 'pool1',
    userId: 'u1',
    name: 'Best movies',
    description: null,
    visibility: 'public',
    entries: [],
    canEdit: true,
    isOwner: true,
    isLikedByViewer: false,
    likeCount: 0,
    comments: [],
    commentCount: 0,
    creatorUsername: null,
    creatorAvatarUrl: null,
    collaborators: [],
    pendingInvites: [],
    viewerCollaboratorStatus: null,
    source: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('VersusPoolDetailPageComponent', () => {
  let versusService: {
    getPool: ReturnType<typeof vi.fn>;
    getResults: ReturnType<typeof vi.fn>;
    startSession: ReturnType<typeof vi.fn>;
    like: ReturnType<typeof vi.fn>;
    unlike: ReturnType<typeof vi.fn>;
    currentSession: ReturnType<typeof vi.fn>;
    addItems: ReturnType<typeof vi.fn>;
    removeItems: ReturnType<typeof vi.fn>;
    updateClip: ReturnType<typeof vi.fn>;
    updatePool: ReturnType<typeof vi.fn>;
  };
  let toast: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };

  function setup(overrides: Partial<VersusPoolResponse> = {}) {
    versusService = {
      getPool: vi.fn().mockReturnValue(of(poolResponse(overrides))),
      getResults: vi
        .fn()
        .mockReturnValue(of({ poolId: 'pool1', completedSessionCount: 0, ranking: [] })),
      startSession: vi.fn().mockReturnValue(of({ sessionId: 'session1', poolId: 'pool1' })),
      like: vi.fn().mockReturnValue(of(poolResponse({ ...overrides, isLikedByViewer: true }))),
      unlike: vi.fn().mockReturnValue(of(poolResponse({ ...overrides, isLikedByViewer: false }))),
      currentSession: vi.fn().mockReturnValue(of(null)),
      addItems: vi.fn().mockReturnValue(of(poolResponse(overrides))),
      removeItems: vi.fn().mockReturnValue(of(poolResponse(overrides))),
      updateClip: vi.fn().mockReturnValue(of(poolResponse(overrides))),
      updatePool: vi.fn().mockReturnValue(of(poolResponse(overrides))),
    };
    toast = { error: vi.fn(), success: vi.fn() };

    TestBed.configureTestingModule({
      imports: [VersusPoolDetailPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap({})),
            snapshot: {
              paramMap: { get: () => 'pool1' },
              queryParamMap: { has: () => false, get: () => null },
            },
          },
        },
        { provide: VersusService, useValue: versusService },
        { provide: ToastService, useValue: toast },
        { provide: ErrorMessageService, useValue: { fromApiError: () => 'error' } },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
        {
          provide: DateFormatService,
          useValue: {
            formatDateTime: () => 'formatted',
            formatDate: () => 'formatted-date',
            formatRelative: () => '2 days ago',
          },
        },
        {
          provide: AuthService,
          useValue: { currentUser: () => ({ id: 'u1' }), isAuthenticated: () => true },
        },
        { provide: PeopleService, useValue: { list: vi.fn() } },
        { provide: ConfirmService, useValue: { ask: vi.fn().mockResolvedValue(true) } },
      ],
    });

    const fixture = TestBed.createComponent(VersusPoolDetailPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('loads the pool and results on init', () => {
    const fixture = setup();

    expect(versusService.getPool).toHaveBeenCalledWith('pool1');
    expect(versusService.getResults).toHaveBeenCalledWith('pool1');
    expect(fixture.componentInstance.pool()).toEqual(poolResponse());
  });

  it('play() starts a session and navigates to the play screen', () => {
    const fixture = setup();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fixture.componentInstance.play();

    expect(versusService.startSession).toHaveBeenCalledWith('pool1');
    expect(navigateSpy).toHaveBeenCalledWith(['/versus', 'pool1', 'play', 'session1']);
  });

  it('toggleLike likes when not liked yet and updates the pool', () => {
    const fixture = setup({ canEdit: false, isOwner: false, isLikedByViewer: false });
    const component = fixture.componentInstance;

    component.toggleLike();

    expect(versusService.like).toHaveBeenCalledWith('pool1');
    expect(component.pool()?.isLikedByViewer).toBe(true);
  });

  it('toggleLike unlikes when already liked', () => {
    const fixture = setup({ canEdit: false, isOwner: false, isLikedByViewer: true });
    const component = fixture.componentInstance;

    component.toggleLike();

    expect(versusService.unlike).toHaveBeenCalledWith('pool1');
  });

  it('toggleLike does nothing for the owner', () => {
    const fixture = setup({ canEdit: true });
    const component = fixture.componentInstance;

    component.toggleLike();

    expect(versusService.like).not.toHaveBeenCalled();
    expect(versusService.unlike).not.toHaveBeenCalled();
  });

  it('offers to resume an unfinished game before starting a new one', () => {
    const fixture = setup();
    expect(versusService.currentSession).toHaveBeenCalledWith('pool1');
    expect(fixture.componentInstance.unfinished()).toBeNull();
  });

  const contenders = [1, 2, 3, 4].map((n) => ({
    id: `e${n}`,
    title: `Entry ${n}`,
    coverUrl: null,
    media: { provider: 'tmdb', mediaType: 'movie', externalId: `${n}` },
    clip: null,
  })) as never;

  it('adds picked titles to the versus in one request', () => {
    const component = setup().componentInstance;

    component.edit.addMedia([{ provider: 'tmdb', mediaType: 'movie', externalId: '9' } as never]);

    expect(versusService.addItems).toHaveBeenCalledWith('pool1', [
      { provider: 'tmdb', mediaType: 'movie', externalId: '9' },
    ]);
  });

  it('hides a removed contender and sends the removal after the undo window', async () => {
    vi.useFakeTimers();
    try {
      const component = setup({ entries: contenders }).componentInstance;

      await component.edit.remove(['e2']);

      expect(component.edit.entries().map((e) => e.id)).toEqual(['e1', 'e3', 'e4']);
      expect(component.edit.enoughEntries()).toBe(false);
      expect(versusService.removeItems).not.toHaveBeenCalled();
      vi.advanceTimersByTime(5000);
      expect(versusService.removeItems).toHaveBeenCalledWith('pool1', ['e2']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('undo keeps the contender and never tells the server', async () => {
    vi.useFakeTimers();
    try {
      const component = setup({ entries: contenders }).componentInstance;

      await component.edit.remove(['e2']);
      toast.success.mock.calls[0][2].run();
      vi.advanceTimersByTime(6000);

      expect(component.edit.entries()).toHaveLength(4);
      expect(versusService.removeItems).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('saves a clip edit from the sheet', () => {
    const component = setup().componentInstance;

    component.edit.updateClip('e1', { startSeconds: 12, linkedMedia: null });

    expect(versusService.updateClip).toHaveBeenCalledWith('pool1', 'e1', {
      startSeconds: 12,
      linkedMedia: null,
    });
  });

  it('only lets the owner publish once there are enough contenders', () => {
    const small = setup({ visibility: 'private' }).componentInstance;
    expect(small.edit.enoughEntries()).toBe(false);

    TestBed.resetTestingModule();
    const ready = setup({ visibility: 'private', entries: contenders }).componentInstance;
    ready.publish('public');

    expect(versusService.updatePool).toHaveBeenCalledWith('pool1', {
      name: 'Best movies',
      description: undefined,
      visibility: 'public',
    });
  });

  it('shows two covers with the vs disc and the description in the header', () => {
    const fixture = setup({
      entries: contenders,
      description: 'Pick the best',
      updatedAt: '2024-02-01T00:00:00Z',
    });
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const art = host.querySelector('[headerArt]')!;

    expect(fixture.componentInstance.artCovers().map((cover) => cover.id)).toEqual([
      'e1',
      'e2',
      'e3',
      'e4',
    ]);
    expect(art.querySelectorAll(':scope > span').length).toBe(2);
    expect(art.textContent?.toLowerCase()).toContain('vs');
    expect(
      host.querySelector<HTMLTextAreaElement>('textarea[aria-label="community.sheet.description"]')
        ?.value,
    ).toBe('Pick the best');
  });

  it('keeps delete without share, duplicate or a second invite', () => {
    const fixture = setup({ collaborators: [], entries: contenders });
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const labels = Array.from(root.querySelectorAll('button')).map(
      (b) => b.getAttribute('title') ?? b.textContent?.trim(),
    );

    expect(root.querySelector('shelfy-menu-button')).toBeNull();
    expect(labels).toContain('studio.delete');
    for (const label of ['creation.menu.copy_link', 'lists.collab.title', 'studio.duplicate']) {
      expect(labels).not.toContain(label);
    }
  });

  it('keeps Play as the brand primary action on a published pool', () => {
    const fixture = setup({ entries: contenders });
    fixture.detectChanges();
    const play = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
      (b) => b.textContent?.includes('versus.detail.play'),
    )!;

    expect(play.className).toContain('satin');
  });

  it('autosaves renaming for the owner only', () => {
    vi.useFakeTimers();
    try {
      const fixture = setup({ isOwner: false });
      fixture.componentInstance.edit.name.set('Hijacked');
      fixture.detectChanges();
      vi.advanceTimersByTime(700);

      expect(versusService.updatePool).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
