import { inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import { TranslateService } from '@app/core/services/translate/translate';

export interface UnsavedChangesAware {
  hasUnsavedChanges(): boolean;
  leaveQuestionKey?(): string;
}

export const unsavedChangesGuard: CanDeactivateFn<UnsavedChangesAware> = (component) =>
  !component.hasUnsavedChanges() ||
  inject(ConfirmService).ask(
    inject(TranslateService).get(component.leaveQuestionKey?.() ?? 'edit.unsaved_changes'),
  );
