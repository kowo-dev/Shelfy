import {
  computed,
  effect,
  signal,
  untracked,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import type { Observable } from 'rxjs';
import type { CollectionVisibility } from '@app/core/services/auth/auth.model';

const DETAILS_DELAY_MS = 700;

export type DetailsState = 'idle' | 'saving' | 'saved' | 'error';

export interface DetailsSyncOptions<T extends { id: string }> {
  target: WritableSignal<T | null>;
  local: Signal<string>;
  server: (current: T) => string;
  apply: (current: T) => void;
  valid: Signal<boolean>;
  canSave: (current: T) => boolean;
  request: (current: T, visibility: CollectionVisibility | undefined) => Observable<T>;
  merge: (latest: T | null, updated: T) => T;
  onSwitch: () => void;
  onError: (error: unknown) => void;
}

export function createDetailsSync<T extends { id: string }>(options: DetailsSyncOptions<T>) {
  const { target, local, valid } = options;
  const state = signal<DetailsState>('idle');
  let loadedId: string | null = null;
  let baseline = '';

  effect(() => {
    const current = target();
    if (!current) return;
    untracked(() => {
      const switched = current.id !== loadedId;
      if (!switched && (local() !== baseline || options.server(current) === local())) return;
      loadedId = current.id;
      options.apply(current);
      baseline = local();
      if (switched) options.onSwitch();
    });
  });

  effect((onCleanup) => {
    const current = target();
    if (local() === baseline || !valid() || !current || !options.canSave(current)) return;
    const timer = setTimeout(() => untracked(() => save()), DETAILS_DELAY_MS);
    onCleanup(() => clearTimeout(timer));
  });

  function save(visibility?: CollectionVisibility): void {
    const current = target();
    if (!current || !options.canSave(current) || !valid()) return;
    const snapshot = local();
    state.set('saving');
    options.request(current, visibility).subscribe({
      next: (updated) => {
        baseline = snapshot;
        target.update((latest) => options.merge(latest, updated));
        state.set('saved');
      },
      error: (error: unknown) => {
        state.set('error');
        options.onError(error);
      },
    });
  }

  return {
    state: state.asReadonly(),
    save,
    flush: () => {
      if (local() !== baseline && valid()) save();
    },
    hasUnsaved: computed(() => state() === 'error'),
  };
}
