import { computed, signal, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '@app/core/services/auth/auth';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ToastService } from '@app/core/services/toast/toast';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { TranslateService } from '@app/core/services/translate/translate';

function buildForm(fb: FormBuilder) {
  return fb.nonNullable.group({
    newEmail: fb.nonNullable.control('', [Validators.required, Validators.email]),
  });
}

export type SettingsEmailForm = ReturnType<typeof buildForm>;

export interface SettingsEmailState {
  form: SettingsEmailForm;
  sending: Signal<boolean>;
  newEmailError: Signal<string>;
  requestChange: () => void;
}

export interface SettingsEmailDependencies {
  fb: FormBuilder;
  authService: AuthService;
  toastService: ToastService;
  errorMessage: ErrorMessageService;
  translate: TranslateService;
}

export function createSettingsEmailState(
  dependencies: SettingsEmailDependencies,
): SettingsEmailState {
  const { fb, authService, toastService, errorMessage, translate } = dependencies;

  const sending = signal(false);
  const form = buildForm(fb);
  const formEvents = toSignal(form.events);

  const newEmailError = computed(() => {
    formEvents();
    const ctrl = form.controls.newEmail;
    if (!ctrl.touched) return '';
    if (ctrl.hasError('required')) return translate.get('auth.errors.field_required');
    if (ctrl.hasError('email')) return translate.get('auth.errors.invalid_email');
    return '';
  });

  function requestChange(): void {
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    sending.set(true);
    const { newEmail } = form.getRawValue();
    authService
      .requestEmailChange({ newEmail })
      .then(() => {
        sending.set(false);
        form.reset({ newEmail: '' });
        toastService.success(translate.get('settings.profile.email.request_sent'));
      })
      .catch((error: unknown) => {
        sending.set(false);
        catchAndToastError(toastService, errorMessage)(error);
      });
  }

  return {
    form,
    sending: sending.asReadonly(),
    newEmailError,
    requestChange,
  };
}
