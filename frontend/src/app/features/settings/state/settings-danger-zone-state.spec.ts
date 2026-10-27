import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import type { AuthService } from '@app/core/services/auth/auth';
import type { CollectionService } from '@app/core/services/collection/collection';
import type { ErrorMessageService } from '@app/core/services/error-message/error-message';
import type { Router } from '@angular/router';
import type { ToastService } from '@app/core/services/toast/toast';
import type { TranslateService } from '@app/core/services/translate/translate';

import {
  createSettingsDangerZoneState,
  type SettingsDangerZoneDependencies,
} from './settings-danger-zone-state';

function create(deps: SettingsDangerZoneDependencies) {
  return TestBed.runInInjectionContext(() => createSettingsDangerZoneState(deps));
}

function makeDeps(overrides: {
  clearAll?: ReturnType<typeof vi.fn>;
  deleteAccount?: ReturnType<typeof vi.fn>;
  username?: string;
}) {
  const authService = {
    deleteAccount: overrides.deleteAccount ?? vi.fn().mockResolvedValue(undefined),
  } as unknown as AuthService;
  const collectionService = {
    clearAll: overrides.clearAll ?? vi.fn().mockReturnValue(of(undefined)),
  } as unknown as CollectionService;
  const router = { navigate: vi.fn() } as unknown as Router;
  const toastService = { success: vi.fn(), error: vi.fn() } as unknown as ToastService;
  const errorMessage = {
    fromApiError: vi.fn().mockReturnValue('err'),
  } as unknown as ErrorMessageService;
  const translate = { get: vi.fn((key: string) => key) } as unknown as TranslateService;
  const username = signal<string | undefined>(overrides.username ?? 'kowo');
  return {
    authService,
    collectionService,
    router,
    toastService,
    errorMessage,
    translate,
    username,
  };
}

describe('createSettingsDangerZoneState', () => {
  it('starts closed and not busy', () => {
    const deps = makeDeps({});
    const state = create(deps);

    expect(state.dialogOpen()).toBe(false);
    expect(state.action()).toBeNull();
    expect(state.busy()).toBe(false);
  });

  it('openDialog() sets action, opens the dialog and clears the confirm control', () => {
    const deps = makeDeps({});
    const state = create(deps);
    state.confirmControl.setValue('something');

    state.openDialog('clear-collection');

    expect(state.action()).toBe('clear-collection');
    expect(state.dialogOpen()).toBe(true);
    expect(state.confirmControl.value).toBe('');
  });

  it('closeDialog() closes when not busy', () => {
    const deps = makeDeps({});
    const state = create(deps);
    state.openDialog('delete-account');

    state.closeDialog();

    expect(state.dialogOpen()).toBe(false);
    expect(state.action()).toBeNull();
  });

  it('confirmMatches() is true only when the confirm value equals the username', () => {
    const deps = makeDeps({ username: 'kowo' });
    const state = create(deps);

    state.confirmControl.setValue('wrong');
    expect(state.confirmMatches()).toBe(false);

    state.confirmControl.setValue('kowo');
    expect(state.confirmMatches()).toBe(true);
  });

  it('confirmMatches() also needs a password when deleting the account', () => {
    const deps = makeDeps({ username: 'kowo' });
    const state = create(deps);
    state.openDialog('delete-account');
    state.confirmControl.setValue('kowo');
    expect(state.confirmMatches()).toBe(false);

    state.passwordControl.setValue('secret-password');
    expect(state.confirmMatches()).toBe(true);
  });

  it('confirmAction() does nothing when confirm text does not match', () => {
    const deps = makeDeps({});
    const state = create(deps);
    state.openDialog('clear-collection');
    state.confirmControl.setValue('wrong');

    state.confirmAction();

    expect(deps.collectionService.clearAll).not.toHaveBeenCalled();
  });

  it('confirmAction() clears the collection on clear-collection and closes the dialog', async () => {
    const deps = makeDeps({});
    const state = create(deps);
    state.openDialog('clear-collection');
    state.confirmControl.setValue('kowo');

    state.confirmAction();
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.collectionService.clearAll).toHaveBeenCalled();
    expect(state.dialogOpen()).toBe(false);
    expect(state.action()).toBeNull();
    expect(deps.toastService.success).toHaveBeenCalled();
  });

  it('confirmAction() shows a toast error when clearing the collection fails', async () => {
    const deps = makeDeps({
      clearAll: vi.fn().mockReturnValue(throwError(() => new Error('boom'))),
    });
    const state = create(deps);
    state.openDialog('clear-collection');
    state.confirmControl.setValue('kowo');

    state.confirmAction();
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.toastService.error).toHaveBeenCalled();
    expect(state.busy()).toBe(false);
  });

  it('confirmAction() deletes the account and navigates to login on delete-account', async () => {
    const deps = makeDeps({});
    const state = create(deps);
    state.openDialog('delete-account');
    state.confirmControl.setValue('kowo');
    state.passwordControl.setValue('secret-password');

    state.confirmAction();
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.authService.deleteAccount).toHaveBeenCalledWith('secret-password');
    expect(deps.router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('confirmAction() shows a toast error when deleting the account fails', async () => {
    const deps = makeDeps({ deleteAccount: vi.fn().mockRejectedValue(new Error('boom')) });
    const state = create(deps);
    state.openDialog('delete-account');
    state.confirmControl.setValue('kowo');
    state.passwordControl.setValue('secret-password');

    state.confirmAction();
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.toastService.error).toHaveBeenCalled();
    expect(state.busy()).toBe(false);
  });

  it('closeDialog() does nothing while busy', () => {
    const deps = makeDeps({ clearAll: vi.fn().mockReturnValue(of(undefined)) });
    const state = create(deps);
    state.openDialog('clear-collection');
    state.confirmControl.setValue('kowo');
    const deps2 = makeDeps({
      clearAll: vi.fn().mockReturnValue({ subscribe: () => undefined }),
    });
    const state2 = create(deps2);
    state2.openDialog('clear-collection');
    state2.confirmControl.setValue('kowo');
    state2.confirmAction();

    state2.closeDialog();

    expect(state2.dialogOpen()).toBe(true);
  });
});
