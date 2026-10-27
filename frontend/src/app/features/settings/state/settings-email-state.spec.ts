import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { vi } from 'vitest';

import type { AuthService } from '@app/core/services/auth/auth';
import type { ErrorMessageService } from '@app/core/services/error-message/error-message';
import type { ToastService } from '@app/core/services/toast/toast';
import type { TranslateService } from '@app/core/services/translate/translate';

import { createSettingsEmailState, type SettingsEmailDependencies } from './settings-email-state';

function makeDeps(requestEmailChange: ReturnType<typeof vi.fn>) {
  const fb = TestBed.inject(FormBuilder);
  const authService = { requestEmailChange } as unknown as AuthService;
  const toastService = { success: vi.fn(), error: vi.fn() } as unknown as ToastService;
  const errorMessage = {
    fromApiError: vi.fn().mockReturnValue('err'),
  } as unknown as ErrorMessageService;
  const translate = { get: vi.fn((key: string) => key) } as unknown as TranslateService;
  return { fb, authService, toastService, errorMessage, translate };
}

function create(deps: SettingsEmailDependencies) {
  return TestBed.runInInjectionContext(() => createSettingsEmailState(deps));
}

describe('createSettingsEmailState', () => {
  it('starts with sending=false and an empty form', () => {
    const deps = makeDeps(vi.fn());
    const state = create(deps);

    expect(state.sending()).toBe(false);
    expect(state.form.controls.newEmail.value).toBe('');
  });

  it('requestChange() marks the form touched and does not call the service when invalid', () => {
    const requestEmailChange = vi.fn();
    const deps = makeDeps(requestEmailChange);
    const state = create(deps);

    state.requestChange();

    expect(requestEmailChange).not.toHaveBeenCalled();
    expect(state.form.controls.newEmail.touched).toBe(true);
    expect(state.newEmailError()).toBe('auth.errors.field_required');
  });

  it('shows invalid_email error when email format is wrong', () => {
    const deps = makeDeps(vi.fn());
    const state = create(deps);

    state.form.controls.newEmail.setValue('not-an-email');
    state.form.controls.newEmail.markAsTouched();

    expect(state.newEmailError()).toBe('auth.errors.invalid_email');
  });

  it('requestChange() calls the service and resets the form on success', async () => {
    const requestEmailChange = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps(requestEmailChange);
    const state = create(deps);
    state.form.controls.newEmail.setValue('new@example.com');

    state.requestChange();
    await Promise.resolve();
    await Promise.resolve();

    expect(requestEmailChange).toHaveBeenCalledWith({ newEmail: 'new@example.com' });
    expect(deps.toastService.success).toHaveBeenCalled();
    expect(state.sending()).toBe(false);
    expect(state.form.controls.newEmail.value).toBe('');
  });

  it('requestChange() shows a toast error on failure', async () => {
    const requestEmailChange = vi.fn().mockRejectedValue(new Error('boom'));
    const deps = makeDeps(requestEmailChange);
    const state = create(deps);
    state.form.controls.newEmail.setValue('new@example.com');

    state.requestChange();
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.toastService.error).toHaveBeenCalled();
    expect(state.sending()).toBe(false);
  });
});
