import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { vi } from 'vitest';

import type { AuthService } from '@app/core/services/auth/auth';
import type { User } from '@app/core/services/auth/auth.model';
import type { ErrorMessageService } from '@app/core/services/error-message/error-message';
import type { ToastService } from '@app/core/services/toast/toast';
import type { TranslateService } from '@app/core/services/translate/translate';

import {
  createSettingsProfileFormState,
  type SettingsProfileFormDependencies,
} from './settings-profile-form-state';

const USER = {
  username: 'kowo',
  displayName: 'Kowo',
  bio: 'hello',
  profileVisibility: 'public',
  isAdultContentAllowed: false,
} as User;

function makeDeps(overrides: {
  currentUser?: User | null;
  checkUsernameAvailability?: ReturnType<typeof vi.fn>;
  updateProfile?: ReturnType<typeof vi.fn>;
}) {
  const fb = TestBed.inject(FormBuilder);
  const authService = {
    currentUser: vi
      .fn()
      .mockReturnValue(overrides.currentUser === undefined ? USER : overrides.currentUser),
    checkUsernameAvailability:
      overrides.checkUsernameAvailability ?? vi.fn().mockReturnValue(of({ isAvailable: true })),
    updateProfile: overrides.updateProfile ?? vi.fn().mockResolvedValue(undefined),
  } as unknown as AuthService;
  const translate = { get: vi.fn((key: string) => key) } as unknown as TranslateService;
  const toastService = { success: vi.fn(), error: vi.fn() } as unknown as ToastService;
  const errorMessage = {
    fromApiError: vi.fn().mockReturnValue('err'),
  } as unknown as ErrorMessageService;
  return { fb, authService, translate, toastService, errorMessage };
}

function create(deps: SettingsProfileFormDependencies) {
  return TestBed.runInInjectionContext(() => createSettingsProfileFormState(deps));
}

describe('createSettingsProfileFormState', () => {
  it('initializes the form from the current user', () => {
    const deps = makeDeps({});
    const state = create(deps);

    expect(state.form.controls.username.value).toBe('kowo');
    expect(state.form.controls.displayName.value).toBe('Kowo');
    expect(state.form.controls.bio.value).toBe('hello');
    expect(state.allowAdultContent()).toBe(false);
    expect(state.saving()).toBe(false);
  });

  it('toggleAdultContent(true) opens the confirm dialog without enabling immediately', () => {
    const deps = makeDeps({});
    const state = create(deps);

    state.toggleAdultContent(true);

    expect(state.adultContentConfirmDialogOpen()).toBe(true);
    expect(state.allowAdultContent()).toBe(false);
  });

  it('toggleAdultContent(false) disables it and saves right away', async () => {
    const deps = makeDeps({});
    const state = create(deps);
    await state.toggleAdultContent(true);
    await state.confirmAdultContent();

    await state.toggleAdultContent(false);

    expect(state.allowAdultContent()).toBe(false);
    expect(deps.authService.updateProfile).toHaveBeenLastCalledWith(
      expect.objectContaining({ isAdultContentAllowed: false }),
    );
  });

  it('confirmAdultContent() enables it, closes the dialog and saves right away', async () => {
    const deps = makeDeps({});
    const state = create(deps);
    await state.toggleAdultContent(true);
    expect(deps.authService.updateProfile).not.toHaveBeenCalled();

    await state.confirmAdultContent();

    expect(state.allowAdultContent()).toBe(true);
    expect(state.adultContentConfirmDialogOpen()).toBe(false);
    expect(deps.authService.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ isAdultContentAllowed: true, confirmAdultContent: true }),
    );
  });

  it('closeAdultContentConfirmDialog() closes without enabling', () => {
    const deps = makeDeps({});
    const state = create(deps);
    state.toggleAdultContent(true);

    state.closeAdultContentConfirmDialog();

    expect(state.adultContentConfirmDialogOpen()).toBe(false);
    expect(state.allowAdultContent()).toBe(false);
  });

  it('usernameError shows required error once touched', () => {
    const deps = makeDeps({});
    const state = create(deps);

    state.form.controls.username.setValue('');
    state.form.controls.username.markAsTouched();

    expect(state.usernameError()).toBe('auth.errors.field_required');
  });

  it('usernameError shows format error for invalid pattern', () => {
    const deps = makeDeps({});
    const state = create(deps);

    state.form.controls.username.setValue('ab');
    state.form.controls.username.markAsTouched();

    expect(state.usernameError()).toBe('auth.errors.username_format');
  });

  it('usernameError shows taken error when unavailable', async () => {
    const deps = makeDeps({
      checkUsernameAvailability: vi.fn().mockReturnValue(of({ isAvailable: false })),
    });
    const state = create(deps);

    state.form.controls.username.setValue('newname');
    state.form.controls.username.markAsTouched();
    await vi.waitFor(() => expect(state.form.controls.username.pending).toBe(false), {
      timeout: 1000,
    });

    expect(state.usernameError()).toBe('auth.errors.username_taken');
  });

  it('displayNameError and bioError show maxlength errors once touched', () => {
    const deps = makeDeps({});
    const state = create(deps);

    state.form.controls.displayName.setValue('x'.repeat(51));
    state.form.controls.displayName.markAsTouched();
    state.form.controls.bio.setValue('x'.repeat(301));
    state.form.controls.bio.markAsTouched();

    expect(state.displayNameError()).toBe('settings.errors.display_name_too_long');
    expect(state.bioError()).toBe('settings.errors.bio_too_long');
  });

  it('save() marks all touched and does not call updateProfile when invalid', async () => {
    const deps = makeDeps({});
    const state = create(deps);
    state.form.controls.username.setValue('');

    await state.save();

    expect(deps.authService.updateProfile).not.toHaveBeenCalled();
    expect(state.form.controls.username.touched).toBe(true);
  });

  it('save() calls updateProfile quietly and clears the changes', async () => {
    const deps = makeDeps({});
    const state = create(deps);
    state.form.controls.displayName.setValue('New name');
    expect(state.hasChanges()).toBe(true);

    await state.save();

    expect(deps.authService.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'kowo', displayName: 'New name' }),
    );
    expect(deps.toastService.success).not.toHaveBeenCalled();
    expect(state.saving()).toBe(false);
    expect(state.hasChanges()).toBe(false);
  });

  it('save() shows a toast error on failure and keeps the changes', async () => {
    const deps = makeDeps({ updateProfile: vi.fn().mockRejectedValue(new Error('boom')) });
    const state = create(deps);
    state.form.controls.bio.setValue('changed');

    await state.save();

    expect(deps.toastService.error).toHaveBeenCalled();
    expect(state.saving()).toBe(false);
    expect(state.hasChanges()).toBe(true);
  });

  it('hasChanges follows the form, reset() undoes it', () => {
    const state = create(makeDeps({}));
    expect(state.hasChanges()).toBe(false);

    state.form.controls.bio.setValue('hello world');
    expect(state.hasChanges()).toBe(true);

    state.reset();
    expect(state.hasChanges()).toBe(false);
    expect(state.form.controls.bio.value).toBe(USER.bio ?? '');
  });

  it('saves the Fediverse choice right away', async () => {
    const updateProfile = vi.fn().mockResolvedValue(undefined);
    const state = create(makeDeps({ updateProfile }));
    expect(state.federationOptOut()).toBe(false);

    await state.setFederationOptOut(true);

    expect(updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ hasOptedOutOfFederation: true }),
    );
    expect(state.federationOptOut()).toBe(true);
    expect(state.hasChanges()).toBe(false);
  });

  it('a preference toggle saves only the saved profile values and keeps edits unsaved', async () => {
    const updateProfile = vi.fn().mockResolvedValue(undefined);
    const state = create(makeDeps({ updateProfile }));
    state.form.controls.displayName.setValue('Edited name');

    await state.setFederationOptOut(true);

    expect(updateProfile).toHaveBeenCalledWith({
      username: 'kowo',
      displayName: 'Kowo',
      bio: 'hello',
      profileVisibility: 'public',
      isAdultContentAllowed: false,
      confirmAdultContent: false,
      hasOptedOutOfFederation: true,
    });
    expect(state.hasChanges()).toBe(true);
    state.form.controls.displayName.setValue('Kowo');
    expect(state.hasChanges()).toBe(false);
  });

  it('a preference toggle reverts and toasts when the save fails', async () => {
    const deps = makeDeps({ updateProfile: vi.fn().mockRejectedValue(new Error('boom')) });
    const state = create(deps);

    await state.setFederationOptOut(true);
    await state.confirmAdultContent();

    expect(state.federationOptOut()).toBe(false);
    expect(state.allowAdultContent()).toBe(false);
    expect(deps.toastService.error).toHaveBeenCalledTimes(2);
    expect(state.hasChanges()).toBe(false);
  });

  it('handles a null current user with empty defaults', () => {
    const deps = makeDeps({ currentUser: null });
    const state = create(deps);

    expect(state.form.controls.username.value).toBe('');
    expect(state.allowAdultContent()).toBe(false);
  });
});
