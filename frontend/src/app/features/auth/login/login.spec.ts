import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '@app/core/services/auth/auth';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { ApiError } from '@app/core/errors/api-error';
import { LegalService } from '@app/core/services/legal/legal';

import { LoginComponent } from './login';

describe('LoginComponent', () => {
  let registrationOpen: BehaviorSubject<boolean>;
  let auth: {
    login: ReturnType<typeof vi.fn>;
    resendVerification: ReturnType<typeof vi.fn>;
  };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let errorMessage: { fromApiError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    registrationOpen = new BehaviorSubject(true);
    auth = {
      login: vi.fn(),
      resendVerification: vi.fn(),
    };
    toastService = { success: vi.fn(), error: vi.fn() };
    errorMessage = { fromApiError: vi.fn().mockReturnValue('Something went wrong') };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toastService },
        { provide: ErrorMessageService, useValue: errorMessage },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
        { provide: LegalService, useValue: { registrationOpen$: registrationOpen } },
      ],
    }).compileComponents();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('marks the form invalid when fields are empty', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    expect(component.loginForm.invalid).toBe(true);
  });

  it('shows required errors after touching empty controls', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component.loginForm.controls.email.markAsTouched();
    component.loginForm.controls.password.markAsTouched();
    component.loginForm.updateValueAndValidity();

    expect(component.emailError()).toBe('auth.errors.field_required');
    expect(component.passwordError()).toBe('auth.errors.field_required');
  });

  it('shows an invalid email error for a malformed address', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component.loginForm.controls.email.setValue('not-an-email');
    component.loginForm.controls.email.markAsTouched();
    component.loginForm.updateValueAndValidity();

    expect(component.emailError()).toBe('auth.errors.invalid_email');
  });

  it('does not submit when the form is invalid and marks all controls as touched', async () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    await component.onSubmit();

    expect(auth.login).not.toHaveBeenCalled();
    expect(component.loginForm.controls.email.touched).toBe(true);
    expect(component.loginForm.controls.password.touched).toBe(true);
  });

  it('logs in and navigates to /discover on success', async () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    auth.login.mockResolvedValue({ id: 'u1' });

    component.loginForm.setValue({ email: 'kowo@example.com', password: 'secret-password' });
    await component.onSubmit();

    expect(auth.login).toHaveBeenCalledWith({
      email: 'kowo@example.com',
      password: 'secret-password',
    });
    expect(navigateSpy).toHaveBeenCalledWith('/discover');
    expect(component.loading()).toBe(false);
  });

  it('shows a server error and does not navigate when login fails', async () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    auth.login.mockRejectedValue(new ApiError(401, 'Invalid credentials', 'INVALID_CREDENTIALS'));
    errorMessage.fromApiError.mockReturnValue('auth.errors.invalid_credentials');

    component.loginForm.setValue({ email: 'kowo@example.com', password: 'wrong-password' });
    await component.onSubmit();

    expect(component.serverError()).toBe('auth.errors.invalid_credentials');
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(component.loading()).toBe(false);
  });

  it('reveals the resend-verification prompt when the error code is EMAIL_NOT_VERIFIED', async () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    auth.login.mockRejectedValue(new ApiError(403, 'Email not verified', 'EMAIL_NOT_VERIFIED'));

    component.loginForm.setValue({ email: 'kowo@example.com', password: 'secret-password' });
    await component.onSubmit();

    expect(component.unverifiedEmail()).toBe('kowo@example.com');
  });

  it('resendVerification calls the service and shows a success toast', async () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    auth.login.mockRejectedValue(new ApiError(403, 'Email not verified', 'EMAIL_NOT_VERIFIED'));
    auth.resendVerification.mockResolvedValue(undefined);

    component.loginForm.setValue({ email: 'kowo@example.com', password: 'secret-password' });
    await component.onSubmit();
    await component.resendVerification();

    expect(auth.resendVerification).toHaveBeenCalledWith({ email: 'kowo@example.com' });
    expect(toastService.success).toHaveBeenCalled();
    expect(component.resending()).toBe(false);
  });

  it('resendVerification does nothing when there is no unverified email', async () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    await component.resendVerification();

    expect(auth.resendVerification).not.toHaveBeenCalled();
  });

  it('resendVerification toasts an error when the service call fails', async () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    auth.login.mockRejectedValue(new ApiError(403, 'Email not verified', 'EMAIL_NOT_VERIFIED'));
    auth.resendVerification.mockRejectedValue(new ApiError(500, 'Boom', 'INTERNAL_SERVER_ERROR'));

    component.loginForm.setValue({ email: 'kowo@example.com', password: 'secret-password' });
    await component.onSubmit();
    await component.resendVerification();

    expect(toastService.error).toHaveBeenCalled();
    expect(component.resending()).toBe(false);
  });

  it('hides the sign-up link when sign-ups are closed', () => {
    const open = createComponent().nativeElement as HTMLElement;
    expect(open.querySelector('a[href^="/auth/register"]')).not.toBeNull();

    registrationOpen.next(false);
    const closedFixture = createComponent();
    closedFixture.detectChanges();
    const closed = closedFixture.nativeElement as HTMLElement;
    expect(closed.querySelector('a[href^="/auth/register"]')).toBeNull();
  });
});
