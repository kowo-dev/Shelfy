import { AuthRequiredError } from '@app/core/services/auth/auth-prompt';
import type { ErrorMessageService } from '@app/core/services/error-message/error-message';
import type { ToastService } from '@app/core/services/toast/toast';
import { catchAndToastError } from './catch-and-toast-error.util';

describe('catchAndToastError', () => {
  function setup() {
    const toastService = { error: vi.fn() } as unknown as ToastService;
    const errorMessage = {
      fromApiError: vi.fn().mockReturnValue('message'),
    } as unknown as ErrorMessageService;
    return { toastService, errorMessage };
  }

  it('does nothing when the error is an AuthRequiredError', () => {
    const { toastService, errorMessage } = setup();
    const handler = catchAndToastError(toastService, errorMessage);

    handler(new AuthRequiredError());

    expect(toastService.error).not.toHaveBeenCalled();
    expect(errorMessage.fromApiError).not.toHaveBeenCalled();
  });

  it('shows a toast with the formatted message for other errors', () => {
    const { toastService, errorMessage } = setup();
    const handler = catchAndToastError(toastService, errorMessage);
    const error = new Error('boom');

    handler(error);

    expect(errorMessage.fromApiError).toHaveBeenCalledWith(error);
    expect(toastService.error).toHaveBeenCalledWith('message');
  });
});
