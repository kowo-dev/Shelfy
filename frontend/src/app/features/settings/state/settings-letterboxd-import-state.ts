import type { DestroyRef } from '@angular/core';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { LetterboxdService } from '@app/core/services/letterboxd/letterboxd';
import type {
  LetterboxdImportEntry,
  LetterboxdImportStatus,
} from '@app/core/services/letterboxd/letterboxd.model';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { createImportJob, type ImportJobState } from './import-job-state';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export interface SettingsLetterboxdImportState extends ImportJobState<
  LetterboxdImportStatus,
  LetterboxdImportEntry
> {
  startImport: (file: File) => void;
}

export interface SettingsLetterboxdImportDependencies {
  letterboxdService: LetterboxdService;
  toastService: ToastService;
  errorMessage: ErrorMessageService;
  translate: TranslateService;
  destroyRef: DestroyRef;
}

export function createSettingsLetterboxdImportState(
  dependencies: SettingsLetterboxdImportDependencies,
): SettingsLetterboxdImportState {
  const { letterboxdService, toastService, translate } = dependencies;
  const job = createImportJob<LetterboxdImportStatus, LetterboxdImportEntry>(
    {
      i18nPrefix: 'settings.import.letterboxd',
      counts: (status) => ({
        imported: status.entriesImported,
        skipped: status.entriesSkipped,
        total: status.entriesTotal,
      }),
      latest: () => letterboxdService.getLatestImport(),
      status: (jobId) => letterboxdService.getImportStatus(jobId),
      entries: (jobId) => letterboxdService.getImportEntries(jobId),
    },
    dependencies,
  );

  function startImport(file: File): void {
    if (!file.name.toLowerCase().endsWith('.zip') || file.size > MAX_FILE_SIZE_BYTES) {
      toastService.error(translate.get('settings.import.letterboxd.errors.invalid_file'));
      return;
    }
    job.begin(letterboxdService.startImport(file));
  }

  return { ...job.state, startImport };
}
