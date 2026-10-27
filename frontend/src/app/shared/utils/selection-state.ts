import { signal } from '@angular/core';

export function createSelectionState() {
  const selectionMode = signal(false);
  const selected = signal<ReadonlySet<string>>(new Set());

  function exitSelection(): void {
    selectionMode.set(false);
    selected.set(new Set());
  }

  return {
    selectionMode: selectionMode.asReadonly(),
    selected: selected.asReadonly(),
    exitSelection,
    toggleSelectionMode(): void {
      if (selectionMode()) exitSelection();
      else selectionMode.set(true);
    },
    toggleSelected(id: string): void {
      selected.update((picked) => {
        const next = new Set(picked);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    selectAll(ids: readonly string[]): void {
      selected.set(new Set(ids));
    },
    deselect(ids: ReadonlySet<string>): void {
      selected.update((picked) => new Set([...picked].filter((id) => !ids.has(id))));
    },
  };
}
