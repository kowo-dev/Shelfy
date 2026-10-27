import type { DestroyRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import type { AuthService } from '@app/core/services/auth/auth';
import type { ErrorMessageService } from '@app/core/services/error-message/error-message';
import type { SteamService } from '@app/core/services/steam/steam';
import type { SteamImportEntry, SteamImportStatus } from '@app/core/services/steam/steam.model';
import type { ToastService } from '@app/core/services/toast/toast';
import type { TranslateService } from '@app/core/services/translate/translate';

import { createSettingsSteamImportState } from './settings-steam-import-state';

function status(overrides: Partial<SteamImportStatus> = {}): SteamImportStatus {
  return {
    jobId: 'job1',
    status: 'pending',
    gamesTotal: 10,
    gamesImported: 0,
    gamesSkipped: 0,
    ...overrides,
  } as SteamImportStatus;
}

function makeDeps(overrides: {
  getAuthorizeUrl?: ReturnType<typeof vi.fn>;
  disconnect?: ReturnType<typeof vi.fn>;
  refreshCurrentUser?: ReturnType<typeof vi.fn>;
  startImport?: ReturnType<typeof vi.fn>;
  getLatestImport?: ReturnType<typeof vi.fn>;
  getImportEntries?: ReturnType<typeof vi.fn>;
}) {
  const steamService = {
    getAuthorizeUrl:
      overrides.getAuthorizeUrl ?? vi.fn().mockReturnValue(of({ url: 'https://steam' })),
    disconnect: overrides.disconnect ?? vi.fn().mockReturnValue(of(undefined)),
    startImport: overrides.startImport ?? vi.fn().mockReturnValue(of(status())),
    getLatestImport: overrides.getLatestImport ?? vi.fn().mockReturnValue(of(status())),
    getImportStatus: vi.fn().mockReturnValue(of(status({ status: 'completed' }))),
    getImportEntries: overrides.getImportEntries ?? vi.fn().mockReturnValue(of([])),
  } as unknown as SteamService;
  const authService = {
    refreshCurrentUser: overrides.refreshCurrentUser ?? vi.fn().mockResolvedValue(undefined),
  } as unknown as AuthService;
  const toastService = { success: vi.fn(), error: vi.fn() } as unknown as ToastService;
  const errorMessage = {
    fromApiError: vi.fn().mockReturnValue('err'),
  } as unknown as ErrorMessageService;
  const translate = { get: vi.fn((key: string) => key) } as unknown as TranslateService;
  const destroyRef = { onDestroy: vi.fn() } as unknown as DestroyRef;
  return { steamService, authService, toastService, errorMessage, translate, destroyRef };
}

describe('createSettingsSteamImportState', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
  });

  it('starts idle', () => {
    const deps = makeDeps({});
    const state = createSettingsSteamImportState(deps);

    expect(state.connecting()).toBe(false);
    expect(state.disconnecting()).toBe(false);
    expect(state.importStatus()).toBeNull();
  });

  it('connect() redirects to the returned authorize url', async () => {
    const deps = makeDeps({});
    const state = createSettingsSteamImportState(deps);

    state.connect();
    await Promise.resolve();

    expect(window.location.href).toBe('https://steam');
  });

  it('connect() shows a toast error on failure', async () => {
    const deps = makeDeps({
      getAuthorizeUrl: vi.fn().mockReturnValue(throwError(() => new Error('boom'))),
    });
    const state = createSettingsSteamImportState(deps);

    state.connect();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.toastService.error).toHaveBeenCalled();
    expect(state.connecting()).toBe(false);
  });

  it('disconnect() refreshes the user and resets import state', async () => {
    const deps = makeDeps({});
    const state = createSettingsSteamImportState(deps);
    state.startImport();
    await Promise.resolve();
    await Promise.resolve();

    state.disconnect();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.authService.refreshCurrentUser).toHaveBeenCalled();
    expect(state.disconnecting()).toBe(false);
    expect(state.importStatus()).toBeNull();
    expect(deps.toastService.success).toHaveBeenCalled();
  });

  it('disconnect() shows a toast error on failure', async () => {
    const deps = makeDeps({
      disconnect: vi.fn().mockReturnValue(throwError(() => new Error('boom'))),
    });
    const state = createSettingsSteamImportState(deps);

    state.disconnect();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.toastService.error).toHaveBeenCalled();
    expect(state.disconnecting()).toBe(false);
  });

  it('startImport() starts the import and reflects status', async () => {
    const deps = makeDeps({});
    const state = createSettingsSteamImportState(deps);

    state.startImport();
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.steamService.startImport).toHaveBeenCalled();
    expect(state.importStarting()).toBe(false);
    expect(state.importStatus()).toEqual(status());
    expect(state.importActive()).toBe(true);
  });

  it('startImport() shows a toast error on failure', async () => {
    const deps = makeDeps({
      startImport: vi.fn().mockReturnValue(throwError(() => new Error('boom'))),
    });
    const state = createSettingsSteamImportState(deps);

    state.startImport();
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.toastService.error).toHaveBeenCalled();
    expect(state.importStarting()).toBe(false);
  });

  it('resumeActiveImport() sets status and swallows errors', async () => {
    const deps = makeDeps({
      getLatestImport: vi.fn().mockReturnValue(throwError(() => new Error('boom'))),
    });
    const state = createSettingsSteamImportState(deps);

    expect(() => state.resumeActiveImport()).not.toThrow();
    await Promise.resolve();
  });

  it('importProgress() computes a rounded percentage from games counts', async () => {
    const deps = makeDeps({
      startImport: vi
        .fn()
        .mockReturnValue(of(status({ gamesTotal: 4, gamesImported: 1, gamesSkipped: 0 }))),
    });
    const state = createSettingsSteamImportState(deps);

    state.startImport();
    await Promise.resolve();
    await Promise.resolve();

    expect(state.importProgress()).toBe(25);
  });

  it('toggleEntries() loads and splits entries', async () => {
    const entries: SteamImportEntry[] = [
      { status: 'imported' } as SteamImportEntry,
      { status: 'skipped' } as SteamImportEntry,
    ];
    const deps = makeDeps({ getImportEntries: vi.fn().mockReturnValue(of(entries)) });
    const state = createSettingsSteamImportState(deps);
    state.startImport();
    await Promise.resolve();
    await Promise.resolve();

    state.toggleEntries();
    await Promise.resolve();

    expect(state.importEntries()).toEqual(entries);
    expect(state.importedEntries()).toEqual([entries[0]]);
    expect(state.skippedEntries()).toEqual([entries[1]]);
  });

  it('toggleEntries() does nothing without an active job', () => {
    const deps = makeDeps({});
    const state = createSettingsSteamImportState(deps);

    state.toggleEntries();

    expect(deps.steamService.getImportEntries).not.toHaveBeenCalled();
  });
});
