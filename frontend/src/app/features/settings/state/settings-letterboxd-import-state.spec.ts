import type { DestroyRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import type { ErrorMessageService } from '@app/core/services/error-message/error-message';
import type { LetterboxdService } from '@app/core/services/letterboxd/letterboxd';
import type {
  LetterboxdImportEntry,
  LetterboxdImportStatus,
} from '@app/core/services/letterboxd/letterboxd.model';
import type { ToastService } from '@app/core/services/toast/toast';
import type { TranslateService } from '@app/core/services/translate/translate';

import { createSettingsLetterboxdImportState } from './settings-letterboxd-import-state';

function status(overrides: Partial<LetterboxdImportStatus> = {}): LetterboxdImportStatus {
  return {
    jobId: 'job1',
    status: 'pending',
    entriesTotal: 10,
    entriesImported: 0,
    entriesSkipped: 0,
    ...overrides,
  } as LetterboxdImportStatus;
}

function makeFile(name: string, size: number): File {
  return { name, size } as File;
}

function makeDeps(overrides: {
  startImport?: ReturnType<typeof vi.fn>;
  getLatestImport?: ReturnType<typeof vi.fn>;
  getImportStatus?: ReturnType<typeof vi.fn>;
  getImportEntries?: ReturnType<typeof vi.fn>;
}) {
  const letterboxdService = {
    startImport: overrides.startImport ?? vi.fn().mockReturnValue(of(status())),
    getLatestImport: overrides.getLatestImport ?? vi.fn().mockReturnValue(of(status())),
    getImportStatus:
      overrides.getImportStatus ?? vi.fn().mockReturnValue(of(status({ status: 'completed' }))),
    getImportEntries: overrides.getImportEntries ?? vi.fn().mockReturnValue(of([])),
  } as unknown as LetterboxdService;
  const toastService = { success: vi.fn(), error: vi.fn() } as unknown as ToastService;
  const errorMessage = {
    fromApiError: vi.fn().mockReturnValue('err'),
  } as unknown as ErrorMessageService;
  const translate = { get: vi.fn((key: string) => key) } as unknown as TranslateService;
  const destroyRef = { onDestroy: vi.fn() } as unknown as DestroyRef;
  return { letterboxdService, toastService, errorMessage, translate, destroyRef };
}

describe('createSettingsLetterboxdImportState', () => {
  it('starts idle with no status', () => {
    const deps = makeDeps({});
    const state = createSettingsLetterboxdImportState(deps);

    expect(state.importStarting()).toBe(false);
    expect(state.importStatus()).toBeNull();
    expect(state.importActive()).toBe(false);
    expect(state.importProgress()).toBe(0);
  });

  it('startImport() rejects a non-zip file', () => {
    const deps = makeDeps({});
    const state = createSettingsLetterboxdImportState(deps);

    state.startImport(makeFile('data.csv', 100));

    expect(deps.toastService.error).toHaveBeenCalled();
    expect(deps.letterboxdService.startImport).not.toHaveBeenCalled();
  });

  it('startImport() rejects a file that is too large', () => {
    const deps = makeDeps({});
    const state = createSettingsLetterboxdImportState(deps);

    state.startImport(makeFile('data.zip', 21 * 1024 * 1024));

    expect(deps.toastService.error).toHaveBeenCalled();
    expect(deps.letterboxdService.startImport).not.toHaveBeenCalled();
  });

  it('startImport() starts the import and begins polling', async () => {
    const deps = makeDeps({});
    const state = createSettingsLetterboxdImportState(deps);

    state.startImport(makeFile('data.zip', 100));
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.letterboxdService.startImport).toHaveBeenCalled();
    expect(state.importStarting()).toBe(false);
    expect(state.importStatus()).toEqual(status());
    expect(state.importActive()).toBe(true);
  });

  it('startImport() shows a toast error on failure', async () => {
    const deps = makeDeps({
      startImport: vi.fn().mockReturnValue(throwError(() => new Error('boom'))),
    });
    const state = createSettingsLetterboxdImportState(deps);

    state.startImport(makeFile('data.zip', 100));
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.toastService.error).toHaveBeenCalled();
    expect(state.importStarting()).toBe(false);
  });

  it('resumeActiveImport() sets the status from the latest import', async () => {
    const deps = makeDeps({
      getLatestImport: vi.fn().mockReturnValue(of(status({ status: 'completed' }))),
    });
    const state = createSettingsLetterboxdImportState(deps);

    state.resumeActiveImport();
    await Promise.resolve();

    expect(state.importStatus()).toEqual(status({ status: 'completed' }));
    expect(state.importActive()).toBe(false);
  });

  it('resumeActiveImport() swallows errors', async () => {
    const deps = makeDeps({
      getLatestImport: vi.fn().mockReturnValue(throwError(() => new Error('boom'))),
    });
    const state = createSettingsLetterboxdImportState(deps);

    expect(() => state.resumeActiveImport()).not.toThrow();
    await Promise.resolve();
  });

  it('importProgress() computes a rounded percentage', async () => {
    const deps = makeDeps({
      startImport: vi
        .fn()
        .mockReturnValue(of(status({ entriesTotal: 10, entriesImported: 2, entriesSkipped: 1 }))),
    });
    const state = createSettingsLetterboxdImportState(deps);

    state.startImport(makeFile('data.zip', 100));
    await Promise.resolve();
    await Promise.resolve();

    expect(state.importProgress()).toBe(30);
  });

  it('toggleEntries() loads entries on first expand and splits skipped/imported', async () => {
    const entries: LetterboxdImportEntry[] = [
      { status: 'imported' } as LetterboxdImportEntry,
      { status: 'skipped' } as LetterboxdImportEntry,
    ];
    const deps = makeDeps({ getImportEntries: vi.fn().mockReturnValue(of(entries)) });
    const state = createSettingsLetterboxdImportState(deps);
    state.startImport(makeFile('data.zip', 100));
    await Promise.resolve();
    await Promise.resolve();

    state.toggleEntries();
    await Promise.resolve();

    expect(state.entriesExpanded()).toBe(true);
    expect(state.importEntries()).toEqual(entries);
    expect(state.importedEntries()).toEqual([entries[0]]);
    expect(state.skippedEntries()).toEqual([entries[1]]);
  });

  it('toggleEntries() collapses without refetching when toggled again', async () => {
    const getImportEntries = vi.fn().mockReturnValue(of([]));
    const deps = makeDeps({ getImportEntries });
    const state = createSettingsLetterboxdImportState(deps);
    state.startImport(makeFile('data.zip', 100));
    await Promise.resolve();
    await Promise.resolve();

    state.toggleEntries();
    await Promise.resolve();
    state.toggleEntries();

    expect(state.entriesExpanded()).toBe(false);
    expect(getImportEntries).toHaveBeenCalledTimes(1);
  });

  it('toggleEntries() does nothing when there is no active job', () => {
    const deps = makeDeps({});
    const state = createSettingsLetterboxdImportState(deps);

    state.toggleEntries();

    expect(state.entriesExpanded()).toBe(true);
    expect(deps.letterboxdService.getImportEntries).not.toHaveBeenCalled();
  });

  it('toggleEntries() collapses and toasts on failure', async () => {
    const deps = makeDeps({
      getImportEntries: vi.fn().mockReturnValue(throwError(() => new Error('boom'))),
    });
    const state = createSettingsLetterboxdImportState(deps);
    state.startImport(makeFile('data.zip', 100));
    await Promise.resolve();
    await Promise.resolve();

    state.toggleEntries();
    await Promise.resolve();
    await Promise.resolve();

    expect(state.entriesExpanded()).toBe(false);
    expect(deps.toastService.error).toHaveBeenCalled();
  });
});
