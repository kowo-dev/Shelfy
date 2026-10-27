import { signal, type Signal } from '@angular/core';
import { AuthService } from '@app/core/services/auth/auth';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ToastService } from '@app/core/services/toast/toast';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';

export interface SettingsPrivacyState {
  exporting: Signal<boolean>;
  exportData: () => void;
}

export interface SettingsPrivacyDependencies {
  authService: AuthService;
  toastService: ToastService;
  errorMessage: ErrorMessageService;
}

export function createSettingsPrivacyState(
  dependencies: SettingsPrivacyDependencies,
): SettingsPrivacyState {
  const { authService, toastService, errorMessage } = dependencies;

  const exporting = signal(false);

  function exportData(): void {
    exporting.set(true);
    authService
      .exportData()
      .catch(catchAndToastError(toastService, errorMessage))
      .finally(() => {
        exporting.set(false);
      });
  }

  return {
    exporting: exporting.asReadonly(),
    exportData,
  };
}
