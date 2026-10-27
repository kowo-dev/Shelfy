import { DestroyRef, inject, signal, type Signal } from '@angular/core';

export const WIDE_LAYOUT_QUERY = '(min-width: 1024px)';

export function mediaQuerySignal(query: string): Signal<boolean> {
  const list = globalThis.matchMedia?.(query);
  const matches = signal(list?.matches ?? false);
  if (!list) return matches.asReadonly();
  const onChange = (event: MediaQueryListEvent) => matches.set(event.matches);
  list.addEventListener('change', onChange);
  inject(DestroyRef).onDestroy(() => list.removeEventListener('change', onChange));
  return matches.asReadonly();
}
