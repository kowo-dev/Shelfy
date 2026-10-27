import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, Validators, FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { InputComponent } from '@app/shared/ui/input/input';
import { ButtonComponent } from '@app/shared/ui/button/button';
import { AuthService } from '@app/core/services/auth/auth';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { passwordMatchValidator } from '@app/shared/utils/password-match-validator.util';
import { maxBytesValidator } from '@app/shared/utils/max-bytes-validator.util';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { readLinkToken } from '../link-token.util';
import { AUTH_LINK_BUTTON } from '../auth-form-head';

@Component({
  selector: 'shelfy-reset-password',
  templateUrl: './reset-password.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, TranslatePipe, ButtonComponent, InputComponent],
})
export class ResetPasswordComponent {
  readonly linkButton = AUTH_LINK_BUTTON;
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly toastService = inject(ToastService);
  private readonly errorMessage = inject(ErrorMessageService);

  private readonly token = readLinkToken(this.route, this.router);
  readonly hasToken = this.token !== null && this.token !== '';

  readonly loading = signal(false);

  readonly resetPasswordForm = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(12), maxBytesValidator(72)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator('newPassword', 'confirmPassword') },
  );

  private readonly formEvents = toSignal(this.resetPasswordForm.events);

  readonly newPasswordError = computed(() => {
    this.formEvents();
    const ctrl = this.resetPasswordForm.controls.newPassword;
    if (!ctrl.touched) return '';
    if (ctrl.hasError('required')) return this.translate.get('auth.errors.field_required');
    if (ctrl.hasError('minlength')) return this.translate.get('auth.errors.weak_password');
    if (ctrl.hasError('maxbytes')) return this.translate.get('auth.errors.password_too_long');
    return '';
  });

  readonly confirmPasswordError = computed(() => {
    this.formEvents();
    const ctrl = this.resetPasswordForm.controls.confirmPassword;
    if (!ctrl.touched) return '';
    if (ctrl.hasError('required')) return this.translate.get('auth.errors.field_required');
    if (this.resetPasswordForm.hasError('passwordsMismatch'))
      return this.translate.get('auth.errors.passwords_mismatch');
    return '';
  });

  async onSubmit(): Promise<void> {
    if (!this.hasToken || this.resetPasswordForm.invalid) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    try {
      const { newPassword } = this.resetPasswordForm.getRawValue();
      await this.auth.resetPassword({ token: this.token as string, newPassword });
      this.toastService.success(this.translate.get('auth.password_reset_success'));
      await this.router.navigate(['/auth/login']);
    } catch (error) {
      catchAndToastError(this.toastService, this.errorMessage)(error);
    } finally {
      this.loading.set(false);
    }
  }
}
