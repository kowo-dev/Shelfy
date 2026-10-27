import { computed, signal, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@app/core/services/auth/auth';
import { CollectionService } from '@app/core/services/collection/collection';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ToastService } from '@app/core/services/toast/toast';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { TranslateService } from '@app/core/services/translate/translate';

export type DangerAction = 'clear-collection' | 'delete-account';

export interface SettingsDangerZoneState {
  confirmControl: FormControl<string>;
  passwordControl: FormControl<string>;
  dialogOpen: Signal<boolean>;
  action: Signal<DangerAction | null>;
  busy: Signal<boolean>;
  confirmMatches: Signal<boolean>;
  openDialog: (action: DangerAction) => void;
  closeDialog: () => void;
  confirmAction: () => void;
}

export interface SettingsDangerZoneDependencies {
  authService: AuthService;
  collectionService: CollectionService;
  router: Router;
  toastService: ToastService;
  errorMessage: ErrorMessageService;
  translate: TranslateService;
  username: Signal<string | undefined>;
}

export function createSettingsDangerZoneState(
  dependencies: SettingsDangerZoneDependencies,
): SettingsDangerZoneState {
  const {
    authService,
    collectionService,
    router,
    toastService,
    errorMessage,
    translate,
    username,
  } = dependencies;

  const confirmControl = new FormControl('', { nonNullable: true });
  const passwordControl = new FormControl('', { nonNullable: true });
  const dialogOpen = signal(false);
  const action = signal<DangerAction | null>(null);
  const clearingCollection = signal(false);
  const deletingAccount = signal(false);
  const busy = computed(() => clearingCollection() || deletingAccount());

  const confirmValue = toSignal(confirmControl.valueChanges, { initialValue: '' });
  const passwordValue = toSignal(passwordControl.valueChanges, { initialValue: '' });
  const confirmMatches = computed(() => {
    const value = confirmValue().trim();
    const usernameMatches = value.length > 0 && value === (username() ?? '');
    return action() === 'delete-account'
      ? usernameMatches && passwordValue().length > 0
      : usernameMatches;
  });

  function openDialog(nextAction: DangerAction): void {
    action.set(nextAction);
    confirmControl.setValue('');
    passwordControl.setValue('');
    dialogOpen.set(true);
  }

  function closeDialog(): void {
    if (busy()) return;
    dialogOpen.set(false);
    action.set(null);
  }

  function confirmAction(): void {
    if (!confirmMatches()) return;
    if (action() === 'clear-collection') {
      runClearCollection();
    } else if (action() === 'delete-account') {
      runDeleteAccount();
    }
  }

  function runClearCollection(): void {
    clearingCollection.set(true);
    firstValueFrom(collectionService.clearAll())
      .then(() => {
        clearingCollection.set(false);
        dialogOpen.set(false);
        action.set(null);
        toastService.success(translate.get('settings.danger_zone.collection_cleared'));
      })
      .catch((error: unknown) => {
        clearingCollection.set(false);
        catchAndToastError(toastService, errorMessage)(error);
      });
  }

  function runDeleteAccount(): void {
    deletingAccount.set(true);
    authService
      .deleteAccount(passwordControl.value)
      .then(() => router.navigate(['/auth/login']))
      .catch((error: unknown) => {
        deletingAccount.set(false);
        catchAndToastError(toastService, errorMessage)(error);
      });
  }

  return {
    confirmControl,
    passwordControl,
    dialogOpen: dialogOpen.asReadonly(),
    action: action.asReadonly(),
    busy,
    confirmMatches,
    openDialog,
    closeDialog,
    confirmAction,
  };
}
