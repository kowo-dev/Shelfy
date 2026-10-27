import { computed, signal, type Signal, type WritableSignal } from '@angular/core';
import type { VersusService } from '@app/core/services/versus/versus';
import type {
  StartVersusSessionResponse,
  VersusMatchResponse,
  VersusSessionStatus,
} from '@app/core/services/versus/versus.model';

export interface VersusSessionState {
  sessionId: Signal<string | null>;
  poolId: Signal<string | null>;
  status: Signal<VersusSessionStatus | null>;
  currentMatch: Signal<VersusMatchResponse | null>;
  bracketSize: Signal<number>;
  roundsTotal: Signal<number>;
  currentRound: Signal<number>;
  winnerEntry: Signal<StartVersusSessionResponse['winnerEntry']>;
  loading: Signal<boolean>;
  picking: Signal<boolean>;
  completed: Signal<boolean>;
  start: (poolId: string) => void;
  resume: (sessionId: string) => void;
  pick: (winnerEntryId: string) => void;
  canUndo: Signal<boolean>;
  undo: () => void;
}

export function createVersusSessionState(
  versusService: VersusService,
  onError: (error: unknown) => void,
): VersusSessionState {
  const loading = signal(false);
  const picking = signal(false);
  const session: WritableSignal<StartVersusSessionResponse | null> = signal(null);

  const sessionId = computed(() => session()?.sessionId ?? null);
  const poolId = computed(() => session()?.poolId ?? null);
  const status = computed(() => session()?.status ?? null);
  const currentMatch = computed(() => session()?.currentMatch ?? null);
  const bracketSize = computed(() => session()?.bracketSize ?? 0);
  const roundsTotal = computed(() => session()?.roundsTotal ?? 0);
  const currentRound = computed(() => session()?.currentRound ?? 0);
  const winnerEntry = computed(() => session()?.winnerEntry ?? null);
  const completed = computed(() => session()?.status === 'completed');
  const picks = signal(0);
  const canUndo = computed(
    () =>
      !picking() &&
      (picks() > 0 || currentRound() > 1 || (currentMatch()?.slotIndex ?? 0) > 0 || completed()),
  );

  function start(poolId: string): void {
    loading.set(true);
    versusService.startSession(poolId).subscribe({
      next: (response) => {
        session.set(response);
        loading.set(false);
      },
      error: (error: unknown) => {
        loading.set(false);
        onError(error);
      },
    });
  }

  function resume(sessionId: string): void {
    loading.set(true);
    versusService.getSession(sessionId).subscribe({
      next: (response) => {
        session.set(response);
        loading.set(false);
      },
      error: (error: unknown) => {
        loading.set(false);
        onError(error);
      },
    });
  }

  function pick(winnerEntryId: string): void {
    const id = sessionId();
    if (!id || picking()) return;
    picking.set(true);
    versusService.submitPick(id, winnerEntryId).subscribe({
      next: (response) => {
        session.set(response);
        picks.update((count) => count + 1);
        picking.set(false);
      },
      error: (error: unknown) => {
        picking.set(false);
        onError(error);
      },
    });
  }

  function undo(): void {
    const id = sessionId();
    if (!id || picking()) return;
    picking.set(true);
    versusService.undoPick(id).subscribe({
      next: (response) => {
        session.set(response);
        picks.update((count) => Math.max(0, count - 1));
        picking.set(false);
      },
      error: (error: unknown) => {
        picks.set(0);
        picking.set(false);
        onError(error);
      },
    });
  }

  return {
    sessionId,
    poolId,
    status,
    currentMatch,
    bracketSize,
    roundsTotal,
    currentRound,
    winnerEntry,
    loading: loading.asReadonly(),
    picking: picking.asReadonly(),
    completed,
    start,
    resume,
    pick,
    canUndo,
    undo,
  };
}
