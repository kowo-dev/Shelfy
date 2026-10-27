import { DestroyRef, inject, signal, type WritableSignal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { concatMap } from 'rxjs/operators';

export function createEditQueue<T>(
  target: WritableSignal<T | null>,
  toastError: (error: unknown) => void,
) {
  const busy = signal(0);
  const queue = new Subject<() => Observable<T>>();
  queue
    .pipe(
      concatMap((op) => {
        busy.update((n) => n + 1);
        return op();
      }),
    )
    .subscribe();
  inject(DestroyRef).onDestroy(() => queue.complete());

  function run(
    op: () => Observable<T>,
    onError?: (error: unknown) => void,
    onDone?: () => void,
  ): void {
    queue.next(
      () =>
        new Observable<T>((subscriber) => {
          const sub = op().subscribe({
            next: (updated) => {
              target.set(updated);
              onDone?.();
              subscriber.next(updated);
            },
            error: (error: unknown) => {
              busy.update((n) => n - 1);
              (onError ?? toastError)(error);
              subscriber.complete();
            },
            complete: () => {
              busy.update((n) => n - 1);
              subscriber.complete();
            },
          });
          return () => sub.unsubscribe();
        }),
    );
  }

  return { run, busy: busy.asReadonly() };
}

export function createUndoableRemoval(options: {
  commit: (ids: string[]) => void;
  announce: (ids: ReadonlySet<string>, undo: () => void) => void;
  windowMs: number;
}) {
  const hidden = signal<ReadonlySet<string>>(new Set());
  let pending: { ids: ReadonlySet<string>; timer: ReturnType<typeof setTimeout> } | null = null;

  function remove(ids: readonly string[]): void {
    if (ids.length === 0) return;
    flush();
    const set = new Set(ids);
    hidden.update((gone) => new Set([...gone, ...set]));
    pending = { ids: set, timer: setTimeout(flush, options.windowMs) };
    options.announce(set, undo);
  }

  function undo(): void {
    if (!pending) return;
    clearTimeout(pending.timer);
    const ids = [...pending.ids];
    pending = null;
    reveal(ids);
  }

  function flush(): void {
    if (!pending) return;
    clearTimeout(pending.timer);
    const ids = [...pending.ids];
    pending = null;
    options.commit(ids);
  }

  function reveal(ids: readonly string[]): void {
    const set = new Set(ids);
    hidden.update((gone) => new Set([...gone].filter((id) => !set.has(id))));
  }

  function reset(): void {
    if (pending) clearTimeout(pending.timer);
    pending = null;
    hidden.set(new Set());
  }

  return { hidden: hidden.asReadonly(), remove, undo, flush, reveal, reset };
}

export const UNDO_WINDOW_MS = 5000;
