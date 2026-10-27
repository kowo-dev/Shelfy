import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '@app/core/services/auth/auth';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { ApiError } from '@app/core/errors/api-error';

import { ResetPasswordComponent } from './reset-password';

describe('ResetPasswordComponent', () => {
  let auth: { resetPassword: ReturnType<typeof vi.fn> };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let errorMessage: { fromApiError: ReturnType<typeof vi.fn> };

  function configure(queryParams: Record<string, string> = {}, fragment = '') {
    auth = { resetPassword: vi.fn() };
    toastService = { success: vi.fn(), error: vi.fn() };
    errorMessage = { fromApiError: vi.fn().mockReturnValue('Something went wrong') };

    return TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toastService },
        { provide: ErrorMessageService, useValue: errorMessage },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              fragment,
              queryParamMap: convertToParamMap(queryParams),
            },
          },
        },
      ],
    }).compileComponents();
  }

  it('has no token and reports hasToken=false when neither query nor fragment carries one', async () => {
    await configure({});
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.hasToken).toBe(false);
  });

  it('reads the token from the query params', async () => {
    await configure({ token: 'from-query' });
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.hasToken).toBe(true);
  });

  it('reads the token from the URL fragment when there is no query param', async () => {
    await configure({}, 'token=from-fragment');
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.hasToken).toBe(true);
  });

  it('clears the URL when a token is present', async () => {
    await configure({ token: 'abc' });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    TestBed.createComponent(ResetPasswordComponent).detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: {} }));
  });

  it('flags a password shorter than the minimum length', async () => {
    await configure({ token: 'abc' });
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.resetPasswordForm.controls.newPassword.setValue('short');
    component.resetPasswordForm.controls.newPassword.markAsTouched();
    component.resetPasswordForm.updateValueAndValidity();

    expect(component.newPasswordError()).toBe('auth.errors.weak_password');
  });

  it('flags a password over the 72-byte limit', async () => {
    await configure({ token: 'abc' });
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.resetPasswordForm.controls.newPassword.setValue('a'.repeat(73));
    component.resetPasswordForm.controls.newPassword.markAsTouched();
    component.resetPasswordForm.updateValueAndValidity();

    expect(component.newPasswordError()).toBe('auth.errors.password_too_long');
  });

  it('flags mismatched password confirmation', async () => {
    await configure({ token: 'abc' });
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.resetPasswordForm.controls.newPassword.setValue('super-secret-password');
    component.resetPasswordForm.controls.confirmPassword.setValue('different-password');
    component.resetPasswordForm.controls.confirmPassword.markAsTouched();
    component.resetPasswordForm.updateValueAndValidity();

    expect(component.confirmPasswordError()).toBe('auth.errors.passwords_mismatch');
  });

  it('does not submit without a token even when the form is valid', async () => {
    await configure({});
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.resetPasswordForm.setValue({
      newPassword: 'super-secret-password',
      confirmPassword: 'super-secret-password',
    });
    await component.onSubmit();

    expect(auth.resetPassword).not.toHaveBeenCalled();
  });

  it('resets the password, toasts success, and navigates to login', async () => {
    await configure({ token: 'reset-token' });
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    auth.resetPassword.mockResolvedValue(undefined);

    component.resetPasswordForm.setValue({
      newPassword: 'super-secret-password',
      confirmPassword: 'super-secret-password',
    });
    await component.onSubmit();

    expect(auth.resetPassword).toHaveBeenCalledWith({
      token: 'reset-token',
      newPassword: 'super-secret-password',
    });
    expect(toastService.success).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/auth/login']);
    expect(component.loading()).toBe(false);
  });

  it('toasts an error when the token is expired/invalid', async () => {
    await configure({ token: 'expired-token' });
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    auth.resetPassword.mockRejectedValue(
      new ApiError(400, 'Token invalid', 'PASSWORD_RESET_TOKEN_INVALID'),
    );

    component.resetPasswordForm.setValue({
      newPassword: 'super-secret-password',
      confirmPassword: 'super-secret-password',
    });
    await component.onSubmit();

    expect(toastService.error).toHaveBeenCalled();
    expect(component.loading()).toBe(false);
  });
});
