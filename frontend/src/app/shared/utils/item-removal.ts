import { inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import type { ToastService } from '@app/core/services/toast/toast';
import type { TranslateService } from '@app/core/services/translate/translate';
import { createUndoableRemoval, UNDO_WINDOW_MS } from './edit-queue';
import type { createSelectionState } from './selection-state';

export interface ItemRemovalOptions<T> {
  target: () => { id: string } | null;
  run: (op: () => Observable<T>, onError?: (error: unknown) => void, onDone?: () => void) => void;
  send: (targetId: string, ids: string[]) => Observable<T>;
  selection: ReturnType<typeof createSelectionState>;
  toast: ToastService;
  translate: TranslateService;
  toastError: (error: unknown) => void;
  titleOf: (ids: ReadonlySet<string>) => string;
  messages: { one: string; many: string; confirmOne: string; confirmMany: string };
}

export function createItemRemoval<T>(options: ItemRemovalOptions<T>) {
  const { target, run, send, selection, toast, translate, toastError, titleOf, messages } = options;
  const confirm = inject(ConfirmService);

  const removal = createUndoableRemoval({
    windowMs: UNDO_WINDOW_MS,
    commit: (ids) => {
      const current = target();
      if (!current) return;
      run(
        () => send(current.id, ids),
        (error) => {
          removal.reveal(ids);
          toastError(error);
        },
        () => removal.reveal(ids),
      );
    },
    announce: (ids, undo) => {
      const single = ids.size === 1;
      toast.success(
        single
          ? translate.get(messages.one, { title: titleOf(ids) })
          : translate.get(messages.many, { count: ids.size }),
        UNDO_WINDOW_MS,
        { label: translate.get('lists.manage.undo'), run: undo },
      );
    },
  });

  async function remove(ids: readonly string[]): Promise<void> {
    if (!target() || ids.length === 0) return;
    const confirmed = await confirm.ask(
      ids.length === 1
        ? translate.get(messages.confirmOne, { title: titleOf(new Set(ids)) })
        : translate.get(messages.confirmMany, { count: ids.length }),
      { confirmLabel: translate.get('edit.selection.remove'), destructive: true },
    );
    if (!confirmed) return;
    selection.deselect(new Set(ids));
    removal.remove(ids);
  }

  return { removal, remove };
}
