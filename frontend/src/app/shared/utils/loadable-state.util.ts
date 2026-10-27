import type { Observable, Subscription } from 'rxjs';
import type { WritableSignal } from '@angular/core';

export function subscribeWithLoading<T>(
  source: Observable<T>,
  onNext: (value: T) => void,
  onError: (error: unknown) => void,
  loading: WritableSignal<boolean> | null = null,
): Subscription {
  loading?.set(true);
  return source.subscribe({
    next: (value) => {
      onNext(value);
      loading?.set(false);
    },
    error: (error: unknown) => {
      loading?.set(false);
      onError(error);
    },
  });
}
