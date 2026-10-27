import { vi } from 'vitest';

import type { AuthService } from '@app/core/services/auth/auth';
import type { ErrorMessageService } from '@app/core/services/error-message/error-message';
import type { ToastService } from '@app/core/services/toast/toast';

import { createSettingsPrivacyState } from './settings-privacy-state';

function makeDeps(exportData: ReturnType<typeof vi.fn>) {
  const authService = { exportData } as unknown as AuthService;
  const toastService = { error: vi.fn() } as unknown as ToastService;
  const errorMessage = {
    fromApiError: vi.fn().mockReturnValue('err'),
  } as unknown as ErrorMessageService;
  return { authService, toastService, errorMessage };
}

describe('createSettingsPrivacyState', () => {
  it('starts with exporting=false', () => {
    const deps = makeDeps(vi.fn().mockResolvedValue(undefined));
    const state = createSettingsPrivacyState(deps);

    expect(state.exporting()).toBe(false);
  });

  it('exportData() sets exporting true then false on success', async () => {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => (resolve = r));
    const deps = makeDeps(vi.fn().mockReturnValue(promise));
    const state = createSettingsPrivacyState(deps);

    state.exportData();
    expect(state.exporting()).toBe(true);

    resolve();
    await promise;
    await Promise.resolve();

    expect(state.exporting()).toBe(false);
  });

  it('exportData() shows a toast error and clears exporting on failure', async () => {
    const deps = makeDeps(vi.fn().mockRejectedValue(new Error('boom')));
    const state = createSettingsPrivacyState(deps);

    state.exportData();
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.toastService.error).toHaveBeenCalled();
    expect(state.exporting()).toBe(false);
  });
});
