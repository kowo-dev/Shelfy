import { IconComponent } from '@shared/ui/icon/icon';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InputComponent } from '@app/shared/ui/input/input';
import { ButtonComponent } from '@app/shared/ui/button/button';
import { AuthService } from '@app/core/services/auth/auth';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { AUTH_LINK_BUTTON, AUTH_MARK, AuthFormHeadComponent } from '../auth-form-head';

@Component({
  selector: 'shelfy-forgot-password',
  templateUrl: './forgot-password.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    AuthFormHeadComponent,
    RouterLink,
    ReactiveFormsModule,
    TranslatePipe,
    ButtonComponent,
    InputComponent,
  ],
})
export class ForgotPasswordComponent {
  readonly linkButton = AUTH_LINK_BUTTON;
  readonly mark = AUTH_MARK;
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly toastService = inject(ToastService);
  private readonly errorMessage = inject(ErrorMessageService);

  readonly loading = signal(false);
  readonly submitted = signal(false);

  readonly forgotPasswordForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  private readonly formEvents = toSignal(this.forgotPasswordForm.events);
  readonly emailError = computed(() => {
    this.formEvents();
    const ctrl = this.forgotPasswordForm.controls.email;
    if (!ctrl.touched) return '';
    if (ctrl.hasError('required')) return this.translate.get('auth.errors.field_required');
    if (ctrl.hasError('email')) return this.translate.get('auth.errors.invalid_email');
    return '';
  });

  async onSubmit(): Promise<void> {
    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    try {
      await this.auth.forgotPassword(this.forgotPasswordForm.getRawValue());
      this.submitted.set(true);
    } catch (error) {
      catchAndToastError(this.toastService, this.errorMessage)(error);
    } finally {
      this.loading.set(false);
    }
  }
}
