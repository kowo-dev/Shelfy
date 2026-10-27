import { IconComponent } from '@shared/ui/icon/icon';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, Validators, FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@app/core/services/auth/auth';
import { InputComponent } from '@app/shared/ui/input/input';
import { ButtonComponent } from '@app/shared/ui/button/button';
import { CheckboxComponent } from '@app/shared/ui/checkbox/checkbox';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { TranslateService } from '@app/core/services/translate/translate';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { passwordMatchValidator } from '@app/shared/utils/password-match-validator.util';
import { maxBytesValidator } from '@app/shared/utils/max-bytes-validator.util';
import { injectRegistrationOpen } from '@app/core/services/legal/legal';
import { AUTH_LINK_BUTTON, AUTH_MARK, AuthFormHeadComponent } from '../auth-form-head';

@Component({
  selector: 'shelfy-register',
  templateUrl: './register.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    AuthFormHeadComponent,
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    ButtonComponent,
    InputComponent,
    CheckboxComponent,
  ],
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly toastService = inject(ToastService);
  private readonly errorMessage = inject(ErrorMessageService);
  private readonly fb = inject(FormBuilder);
  readonly registrationOpen = injectRegistrationOpen();
  readonly linkButton = AUTH_LINK_BUTTON;
  readonly mark = AUTH_MARK;

  readonly registerForm = this.fb.nonNullable.group(
    {
      username: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(50),
          Validators.pattern(/^[a-zA-Z0-9_]+$/),
        ],
      ],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(12), maxBytesValidator(72)]],
      confirmPassword: ['', [Validators.required]],
      termsAccepted: [false, Validators.requiredTrue],
    },
    { validators: passwordMatchValidator('password', 'confirmPassword') },
  );

  private readonly formEvents = toSignal(this.registerForm.events);

  readonly loading = signal(false);
  readonly serverError = signal('');
  readonly returnUrl = computed(() => {
    const candidate = this.route.snapshot.queryParamMap.get('returnUrl');
    return candidate?.startsWith('/') &&
      !candidate.startsWith('//') &&
      !candidate.startsWith('/auth')
      ? candidate
      : null;
  });

  readonly usernameError = computed(() => {
    this.formEvents();
    const ctrl = this.registerForm.controls.username;
    if (!ctrl.touched) return '';
    if (ctrl.hasError('required')) return this.translate.get('auth.errors.field_required');
    if (ctrl.hasError('minlength') || ctrl.hasError('maxlength') || ctrl.hasError('pattern'))
      return this.translate.get('auth.errors.username_format');
    if (ctrl.hasError('usernameTaken')) return this.translate.get('auth.errors.username_taken');
    return '';
  });

  readonly emailError = computed(() => {
    this.formEvents();
    const ctrl = this.registerForm.controls.email;
    if (!ctrl.touched) return '';
    if (ctrl.hasError('required')) return this.translate.get('auth.errors.field_required');
    if (ctrl.hasError('email')) return this.translate.get('auth.errors.invalid_email');

    return '';
  });

  readonly passwordError = computed(() => {
    this.formEvents();
    const ctrl = this.registerForm.controls.password;
    if (!ctrl.touched) return '';
    if (ctrl.hasError('required')) return this.translate.get('auth.errors.field_required');
    if (ctrl.hasError('minlength')) return this.translate.get('auth.errors.weak_password');
    if (ctrl.hasError('maxbytes')) return this.translate.get('auth.errors.password_too_long');
    return '';
  });

  readonly confirmPasswordError = computed(() => {
    this.formEvents();
    const ctrl = this.registerForm.controls.confirmPassword;
    if (!ctrl.touched) return '';
    if (ctrl.hasError('required')) return this.translate.get('auth.errors.field_required');
    if (this.registerForm.hasError('passwordsMismatch'))
      return this.translate.get('auth.errors.passwords_mismatch');
    return '';
  });

  readonly termsError = computed(() => {
    this.formEvents();
    const ctrl = this.registerForm.controls.termsAccepted;
    if (!ctrl.touched) return '';
    if (ctrl.hasError('required')) return this.translate.get('auth.errors.terms_required');
    return '';
  });

  async onSubmit(): Promise<void> {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.serverError.set('');

    try {
      const { username, email, password } = this.registerForm.getRawValue();
      const user = await this.auth.register({ username, email, password });
      this.toastService.success(
        this.translate.get(
          user.isEmailVerified ? 'auth.account_ready' : 'auth.verification_email_sent',
        ),
      );
      const returnUrl = this.returnUrl();
      await this.router.navigate(['/auth/login'], {
        queryParams: returnUrl ? { returnUrl } : {},
      });
    } catch (error) {
      const message = this.errorMessage.fromApiError(error);
      this.serverError.set(message);
    } finally {
      this.loading.set(false);
    }
  }
}
