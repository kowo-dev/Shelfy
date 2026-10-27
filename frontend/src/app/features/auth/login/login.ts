import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { InputComponent } from '@app/shared/ui/input/input';
import { ButtonComponent } from '@app/shared/ui/button/button';
import { AuthService } from '@app/core/services/auth/auth';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ApiError } from '@app/core/errors/api-error';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { injectRegistrationOpen } from '@app/core/services/legal/legal';
import { AuthFormHeadComponent } from '../auth-form-head';

@Component({
  selector: 'shelfy-login',
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AuthFormHeadComponent,
    RouterLink,
    ReactiveFormsModule,
    TranslatePipe,
    ButtonComponent,
    InputComponent,
  ],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  readonly registrationOpen = injectRegistrationOpen();
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly toastService = inject(ToastService);
  private readonly errorMessage = inject(ErrorMessageService);

  readonly loading = signal(false);
  readonly serverError = signal('');
  readonly unverifiedEmail = signal('');
  readonly resending = signal(false);

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  private readonly formEvents = toSignal(this.loginForm.events);
  readonly emailError = computed(() => {
    this.formEvents();
    const ctrl = this.loginForm.controls.email;
    if (!ctrl.touched) return '';
    if (ctrl.hasError('required')) return this.translate.get('auth.errors.field_required');
    if (ctrl.hasError('email')) return this.translate.get('auth.errors.invalid_email');
    return '';
  });

  readonly passwordError = computed(() => {
    this.formEvents();
    const ctrl = this.loginForm.controls.password;
    if (!ctrl.touched) return '';
    if (ctrl.hasError('required')) return this.translate.get('auth.errors.field_required');
    return '';
  });

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.serverError.set('');
    this.unverifiedEmail.set('');
    try {
      await this.auth.login(this.loginForm.getRawValue());
      await this.router.navigateByUrl(this.returnUrl());
    } catch (error) {
      const message = this.errorMessage.fromApiError(error);
      this.serverError.set(message);
      if (error instanceof ApiError && error.code === 'EMAIL_NOT_VERIFIED') {
        this.unverifiedEmail.set(this.loginForm.controls.email.value);
      }
    } finally {
      this.loading.set(false);
    }
  }

  readonly returnUrl = computed(() => {
    const candidate = this.route.snapshot.queryParamMap.get('returnUrl');
    return candidate?.startsWith('/') &&
      !candidate.startsWith('//') &&
      !candidate.startsWith('/auth')
      ? candidate
      : '/discover';
  });

  async resendVerification(): Promise<void> {
    const email = this.unverifiedEmail();
    if (!email) return;

    this.resending.set(true);
    try {
      await this.auth.resendVerification({ email });
      this.toastService.success(this.translate.get('auth.verification_email_sent'));
    } catch (error) {
      catchAndToastError(this.toastService, this.errorMessage)(error);
    } finally {
      this.resending.set(false);
    }
  }
}
