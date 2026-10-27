import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import type { VersusService } from '@app/core/services/versus/versus';
import type { StartVersusSessionResponse } from '@app/core/services/versus/versus.model';

import { createVersusSessionState } from './versus-session-state';

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

describe('createVersusSessionState', () => {
  it('starts empty', () => {
    const state = createVersusSessionState({} as VersusService, vi.fn());

    expect(state.sessionId()).toBeNull();
    expect(state.currentMatch()).toBeNull();
    expect(state.completed()).toBe(false);
    expect(state.loading()).toBe(false);
  });

  it('start() populates the session on success', () => {
    const versusService = {
      startSession: vi.fn().mockReturnValue(of(sessionResponse())),
    } as unknown as VersusService;
    const state = createVersusSessionState(versusService, vi.fn());

    state.start('pool1');

    expect(versusService.startSession).toHaveBeenCalledWith('pool1');
    expect(state.sessionId()).toBe('session1');
    expect(state.roundsTotal()).toBe(2);
    expect(state.loading()).toBe(false);
  });

  it('start() reports the error and stops loading', () => {
    const onError = vi.fn();
    const versusService = {
      startSession: vi.fn().mockReturnValue(throwError(() => new Error('too small'))),
    } as unknown as VersusService;
    const state = createVersusSessionState(versusService, onError);

    state.start('pool1');

    expect(onError).toHaveBeenCalled();
    expect(state.loading()).toBe(false);
    expect(state.sessionId()).toBeNull();
  });

  it('resume() loads an in-progress session by id', () => {
    const versusService = {
      getSession: vi.fn().mockReturnValue(of(sessionResponse({ currentRound: 2 }))),
    } as unknown as VersusService;
    const state = createVersusSessionState(versusService, vi.fn());

    state.resume('session1');

    expect(versusService.getSession).toHaveBeenCalledWith('session1');
    expect(state.currentRound()).toBe(2);
  });

  it('pick() submits the winner and updates the session', () => {
    const versusService = {
      startSession: vi.fn().mockReturnValue(of(sessionResponse())),
      submitPick: vi
        .fn()
        .mockReturnValue(
          of(sessionResponse({ status: 'completed', winnerEntry: { id: 'm1' } as never })),
        ),
    } as unknown as VersusService;
    const state = createVersusSessionState(versusService, vi.fn());
    state.start('pool1');

    state.pick('m1');

    expect(versusService.submitPick).toHaveBeenCalledWith('session1', 'm1');
    expect(state.completed()).toBe(true);
    expect(state.picking()).toBe(false);
  });

  it('pick() does nothing without an active session', () => {
    const versusService = { submitPick: vi.fn() } as unknown as VersusService;
    const state = createVersusSessionState(versusService, vi.fn());

    state.pick('m1');

    expect(versusService.submitPick).not.toHaveBeenCalled();
  });

  it('pick() ignores concurrent calls while a pick is in flight', () => {
    const pickSubject = new Subject<StartVersusSessionResponse>();
    const versusService = {
      startSession: vi.fn().mockReturnValue(of(sessionResponse())),
      submitPick: vi.fn().mockReturnValue(pickSubject.asObservable()),
    } as unknown as VersusService;
    const state = createVersusSessionState(versusService, vi.fn());
    state.start('pool1');

    state.pick('m1');
    expect(state.picking()).toBe(true);
    state.pick('m2');

    expect(versusService.submitPick).toHaveBeenCalledTimes(1);
    pickSubject.next(sessionResponse());
    expect(state.picking()).toBe(false);
  });
});
