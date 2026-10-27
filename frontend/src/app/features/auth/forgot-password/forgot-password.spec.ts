import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '@app/core/services/auth/auth';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { ApiError } from '@app/core/errors/api-error';

import { ForgotPasswordComponent } from './forgot-password';

describe('ForgotPasswordComponent', () => {
  let auth: { forgotPassword: ReturnType<typeof vi.fn> };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let errorMessage: { fromApiError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    auth = { forgotPassword: vi.fn() };
    toastService = { success: vi.fn(), error: vi.fn() };
    errorMessage = { fromApiError: vi.fn().mockReturnValue('Something went wrong') };

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toastService },
        { provide: ErrorMessageService, useValue: errorMessage },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('is invalid when the email is empty', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance.forgotPasswordForm.invalid).toBe(true);
  });

  it('shows a required error once touched', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    component.forgotPasswordForm.controls.email.markAsTouched();
    component.forgotPasswordForm.updateValueAndValidity();

    expect(component.emailError()).toBe('auth.errors.field_required');
  });

  it('shows an invalid-email error for a malformed address', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    component.forgotPasswordForm.controls.email.setValue('not-an-email');
    component.forgotPasswordForm.controls.email.markAsTouched();
    component.forgotPasswordForm.updateValueAndValidity();

    expect(component.emailError()).toBe('auth.errors.invalid_email');
  });

  it('does not submit an invalid form', async () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    await component.onSubmit();

    expect(auth.forgotPassword).not.toHaveBeenCalled();
    expect(component.forgotPasswordForm.controls.email.touched).toBe(true);
  });

  it('submits and flips to the submitted state on success', async () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    auth.forgotPassword.mockResolvedValue(undefined);

    component.forgotPasswordForm.controls.email.setValue('kowo@example.com');
    await component.onSubmit();

    expect(auth.forgotPassword).toHaveBeenCalledWith({ email: 'kowo@example.com' });
    expect(component.submitted()).toBe(true);
    expect(component.loading()).toBe(false);
  });

  it('toasts an error and stays on the form when the request fails', async () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    auth.forgotPassword.mockRejectedValue(new ApiError(404, 'User not found', 'USER_NOT_FOUND'));

    component.forgotPasswordForm.controls.email.setValue('kowo@example.com');
    await component.onSubmit();

    expect(toastService.error).toHaveBeenCalled();
    expect(component.submitted()).toBe(false);
    expect(component.loading()).toBe(false);
  });
});
