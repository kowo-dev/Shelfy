import { of } from 'rxjs';
import { vi } from 'vitest';

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { AuthService } from '@app/core/services/auth/auth';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { VersusService } from '@app/core/services/versus/versus';
import type {
  VersusFollowedSession,
  VersusSessionResult,
} from '@app/core/services/versus/versus.model';

import { VersusResultPageComponent } from './versus-result';

const entry = (id: string) => ({ id, title: id, coverUrl: null, media: null, clip: null });

function result(overrides: Partial<VersusSessionResult> = {}): VersusSessionResult {
  return {
    sessionId: 'session1',
    poolId: 'pool1',
    poolName: 'Best four',
    player: { username: 'kowo', displayName: null, avatarUrl: null },
    completedAt: '2026-10-18T10:00:00Z',
    entryCount: 4,
    podium: [
      { entry: entry('a'), place: 1, communityRank: 1 },
      { entry: entry('b'), place: 2, communityRank: 3 },
      { entry: entry('c'), place: 3, communityRank: 2 },
      { entry: entry('d'), place: 3, communityRank: 4 },
    ],
    agreement: 75,
    communitySessionCount: 5,
    gaps: [],
    ...overrides,
  };
}

describe('VersusResultPageComponent', () => {
  function setup(signedIn = true) {
    const friend: VersusFollowedSession = {
      sessionId: 'session2',
      player: { username: 'sarah', displayName: null, avatarUrl: null },
      winner: entry('b'),
      completedAt: '2026-10-17T10:00:00Z',
    };
    const versus = {
      sessionResult: vi
        .fn()
        .mockImplementation((id: string) =>
          of(id === 'session1' ? result() : result({ sessionId: 'session2' })),
        ),
      followedSessions: vi.fn().mockReturnValue(of([friend])),
      startSession: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [VersusResultPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: (key: string) => ({ poolId: 'pool1', sessionId: 'session1' })[key] },
            },
          },
        },
        { provide: VersusService, useValue: versus },
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: () => signedIn,
            currentUser: () => (signedIn ? { username: 'kowo' } : null),
          },
        },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: ErrorMessageService, useValue: { fromApiError: () => 'error' } },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
        { provide: DateFormatService, useValue: { formatRelative: () => 'today' } },
      ],
    });
    TestBed.overrideComponent(VersusResultPageComponent, { set: { template: '' } });
    const fixture = TestBed.createComponent(VersusResultPageComponent);
    fixture.detectChanges();
    return { page: fixture.componentInstance, versus, friend };
  }

  it('loads the game and tells how many finalists the community agrees with', () => {
    const { page } = setup();

    expect(page.result()?.poolName).toBe('Best four');
    expect(page.sharedCount()).toBe(3);
    expect(page.isMine()).toBe(true);
    expect(page.firstGame()).toBe(false);
  });

  it("puts a friend's podium next to yours, and takes it away on a second tap", () => {
    const { page, versus, friend } = setup();
    expect(page.friends()).toEqual([friend]);

    page.compareWith(friend);
    expect(versus.sessionResult).toHaveBeenCalledWith('session2');
    expect(page.friend()?.sessionId).toBe('session2');

    page.compareWith(friend);
    expect(page.friend()).toBeNull();
  });

  it('shows a shared result to a visitor without asking for friends', () => {
    const { page, versus } = setup(false);

    expect(page.result()).not.toBeNull();
    expect(page.isMine()).toBe(false);
    expect(versus.followedSessions).not.toHaveBeenCalled();
  });
});
