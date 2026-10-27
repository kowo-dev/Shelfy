import { of } from 'rxjs';
import { vi } from 'vitest';

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { VersusService } from '@app/core/services/versus/versus';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { TranslateService } from '@app/core/services/translate/translate';
import type { StartVersusSessionResponse } from '@app/core/services/versus/versus.model';

import { VersusPlayPageComponent } from './versus-play';

function sessionResponse(
  overrides: Partial<StartVersusSessionResponse> = {},
): StartVersusSessionResponse {
  return {
    sessionId: 'session1',
    poolId: 'pool1',
    status: 'in_progress',
    bracketSize: 4,
    roundsTotal: 2,
    currentRound: 1,
    currentMatch: {
      id: 'match1',
      round: 1,
      slotIndex: 0,
      entryA: null,
      entryB: null,
      winnerEntryId: null,
      isDecided: false,
    },
    winnerEntry: null,
    ...overrides,
  };
}

describe('VersusPlayPageComponent', () => {
  function setup(
    params: Record<string, string | null>,
    versusOverrides: Record<string, unknown> = {},
  ) {
    const versusService = {
      startSession: vi.fn().mockReturnValue(of(sessionResponse())),
      getSession: vi.fn().mockReturnValue(of(sessionResponse())),
      submitPick: vi.fn().mockReturnValue(of(sessionResponse())),
      ...versusOverrides,
    };

    TestBed.configureTestingModule({
      imports: [VersusPlayPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (key: string) => params[key] ?? null } } },
        },
        { provide: VersusService, useValue: versusService },
        { provide: ToastService, useValue: { error: vi.fn() } },
        { provide: ErrorMessageService, useValue: { fromApiError: () => 'error' } },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });

    const fixture = TestBed.createComponent(VersusPlayPageComponent);
    fixture.detectChanges();
    return { fixture, versusService };
  }

  it('starts a new session when only a poolId is present', () => {
    const { versusService } = setup({ poolId: 'pool1', sessionId: null });

    expect(versusService.startSession).toHaveBeenCalledWith('pool1');
    expect(versusService.getSession).not.toHaveBeenCalled();
  });

  it('resumes an existing session when a sessionId is present', () => {
    const { versusService } = setup({ poolId: 'pool1', sessionId: 'session1' });

    expect(versusService.getSession).toHaveBeenCalledWith('session1');
    expect(versusService.startSession).not.toHaveBeenCalled();
  });

  it('pick() delegates to the session state', () => {
    const { fixture, versusService } = setup({ poolId: 'pool1', sessionId: null });

    fixture.componentInstance.pick('m1');

    expect(versusService.submitPick).toHaveBeenCalledWith('session1', 'm1');
  });

  it('opens the result page once the game is won', () => {
    const navigate = vi.spyOn(Router.prototype, 'navigate').mockResolvedValue(true);
    const { fixture } = setup(
      { poolId: 'pool1', sessionId: 'session1' },
      { getSession: vi.fn().mockReturnValue(of(sessionResponse({ status: 'completed' }))) },
    );
    fixture.detectChanges();

    expect(navigate).toHaveBeenCalledWith(['/versus', 'pool1', 'results', 'session1'], {
      replaceUrl: true,
    });
    navigate.mockRestore();
  });

  it('undoes the last pick from the button and from Backspace', () => {
    const undoPick = vi.fn().mockReturnValue(of(sessionResponse()));
    const { fixture } = setup({ poolId: 'pool1', sessionId: null }, { undoPick });
    const page = fixture.componentInstance;
    page.pick('m1');

    page.undo();
    expect(undoPick).toHaveBeenCalledWith('session1');

    page.pick('m1');
    page.onKeydown(new KeyboardEvent('keydown', { key: 'Backspace' }));
    expect(undoPick).toHaveBeenCalledTimes(2);
  });

  it('cannot undo before the first pick', () => {
    const undoPick = vi.fn();
    const { fixture } = setup({ poolId: 'pool1', sessionId: null }, { undoPick });

    fixture.componentInstance.undo();

    expect(undoPick).not.toHaveBeenCalled();
  });

  it('quit goes back to the pool', () => {
    const { fixture } = setup({ poolId: 'pool1', sessionId: null });
    expect(fixture.componentInstance.poolUrl()).toEqual(['/versus', 'pool1']);
  });
});
