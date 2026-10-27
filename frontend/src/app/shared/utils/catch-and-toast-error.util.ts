import { AuthRequiredError } from '@app/core/services/auth/auth-prompt';
import type { ErrorMessageService } from '@app/core/services/error-message/error-message';
import type { ToastService } from '@app/core/services/toast/toast';

export function catchAndToastError(
  toastService: ToastService,
  errorMessage: ErrorMessageService,
): (error: unknown) => void {
  return (error: unknown) => {
    if (error instanceof AuthRequiredError) {
      return;
    }
    toastService.error(errorMessage.fromApiError(error));
  };
}
