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

import { RegisterComponent } from './register';

describe('RegisterComponent', () => {
  let registrationOpen: BehaviorSubject<boolean>;
  let auth: { register: ReturnType<typeof vi.fn> };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let errorMessage: { fromApiError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    registrationOpen = new BehaviorSubject(true);
    auth = { register: vi.fn() };
    toastService = { success: vi.fn(), error: vi.fn() };
    errorMessage = { fromApiError: vi.fn().mockReturnValue('Something went wrong') };

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
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
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();
    return fixture;
  }

  function fillValid(component: RegisterComponent) {
    component.registerForm.setValue({
      username: 'kowo',
      email: 'kowo@example.com',
      password: 'super-secret-password',
      confirmPassword: 'super-secret-password',
      termsAccepted: true,
    });
  }

  it('is invalid when empty', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance.registerForm.invalid).toBe(true);
  });

  it('flags a username that is too short or has invalid characters', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    const ctrl = component.registerForm.controls.username;

    ctrl.setValue('ab');
    ctrl.markAsTouched();
    component.registerForm.updateValueAndValidity();
    expect(component.usernameError()).toBe('auth.errors.username_format');

    ctrl.setValue('bad name!');
    component.registerForm.updateValueAndValidity();
    expect(component.usernameError()).toBe('auth.errors.username_format');
  });

  it('flags an invalid email', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    component.registerForm.controls.email.setValue('nope');
    component.registerForm.controls.email.markAsTouched();
    component.registerForm.updateValueAndValidity();

    expect(component.emailError()).toBe('auth.errors.invalid_email');
  });

  it('flags a password shorter than the minimum length', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    component.registerForm.controls.password.setValue('short');
    component.registerForm.controls.password.markAsTouched();
    component.registerForm.updateValueAndValidity();

    expect(component.passwordError()).toBe('auth.errors.weak_password');
  });

  it('flags a password over the 72-byte limit even when it is under 72 characters', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    component.registerForm.controls.password.setValue('é'.repeat(40));
    component.registerForm.controls.password.markAsTouched();
    component.registerForm.updateValueAndValidity();

    expect(component.passwordError()).toBe('auth.errors.password_too_long');
  });

  it('flags mismatched password confirmation', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    component.registerForm.controls.password.setValue('super-secret-password');
    component.registerForm.controls.confirmPassword.setValue('different-password');
    component.registerForm.controls.confirmPassword.markAsTouched();
    component.registerForm.updateValueAndValidity();

    expect(component.confirmPasswordError()).toBe('auth.errors.passwords_mismatch');
  });

  it('requires the terms checkbox to be accepted', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    component.registerForm.controls.termsAccepted.markAsTouched();
    component.registerForm.updateValueAndValidity();

    expect(component.termsError()).toBe('auth.errors.terms_required');
  });

  it('does not submit an invalid form and marks all controls touched', async () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    await component.onSubmit();

    expect(auth.register).not.toHaveBeenCalled();
    expect(component.registerForm.controls.termsAccepted.touched).toBe(true);
  });

  it('registers, toasts success, and navigates to login on success', async () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    auth.register.mockResolvedValue({ id: 'u1' });

    fillValid(component);
    await component.onSubmit();

    expect(auth.register).toHaveBeenCalledWith({
      username: 'kowo',
      email: 'kowo@example.com',
      password: 'super-secret-password',
    });
    expect(toastService.success).toHaveBeenCalledWith('auth.verification_email_sent');
    expect(navigateSpy).toHaveBeenCalledWith(['/auth/login'], { queryParams: {} });
    expect(component.loading()).toBe(false);
  });

  it('tells a user who needs no email verification that the account is ready', async () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    auth.register.mockResolvedValue({ id: 'u1', isEmailVerified: true });

    fillValid(component);
    await component.onSubmit();

    expect(toastService.success).toHaveBeenCalledWith('auth.account_ready');
  });

  it('shows a server error and does not navigate when register fails', async () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    auth.register.mockRejectedValue(
      new ApiError(409, 'Email already used', 'EMAIL_ALREADY_IN_USE'),
    );
    errorMessage.fromApiError.mockReturnValue('auth.errors.email_already_used');

    fillValid(component);
    await component.onSubmit();

    expect(component.serverError()).toBe('auth.errors.email_already_used');
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(component.loading()).toBe(false);
  });

  it('shows that sign-ups are closed instead of the form', () => {
    registrationOpen.next(false);
    const fixture = createComponent();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('form')).toBeNull();
    expect(element.textContent).toContain('auth.registration_closed_title');
    expect(element.querySelector('a[href="/auth/login"]')).not.toBeNull();
  });
});
