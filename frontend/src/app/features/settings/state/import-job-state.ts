import { computed, signal, type DestroyRef, type Signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, interval, switchMap, takeWhile, type Observable } from 'rxjs';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';

const IMPORT_POLL_INTERVAL_MS = 2000;

interface ImportJobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

interface ImportJobEntry {
  status: 'imported' | 'skipped';
}

export interface ImportJobSource<S extends ImportJobStatus, E extends ImportJobEntry> {
  i18nPrefix: string;
  counts: (status: S) => { imported: number; skipped: number; total: number };
  latest: () => Observable<S>;
  status: (jobId: string) => Observable<S>;
  entries: (jobId: string) => Observable<E[]>;
}

export interface ImportJobDependencies {
  toastService: ToastService;
  errorMessage: ErrorMessageService;
  translate: TranslateService;
  destroyRef: DestroyRef;
}

export interface ImportJobState<S, E> {
  importStarting: Signal<boolean>;
  importStatus: Signal<S | null>;
  importEntries: Signal<E[] | null>;
  entriesLoading: Signal<boolean>;
  entriesExpanded: Signal<boolean>;
  importActive: Signal<boolean>;
  importProgress: Signal<number>;
  skippedEntries: Signal<E[]>;
  importedEntries: Signal<E[]>;
  resumeActiveImport: () => void;
  toggleEntries: () => void;
}

export interface ImportJob<S, E> {
  state: ImportJobState<S, E>;
  begin: (start: Observable<S>) => void;
  reset: () => void;
}

const isRunning = (status: ImportJobStatus | null) =>
  status?.status === 'pending' || status?.status === 'processing';

export function createImportJob<S extends ImportJobStatus, E extends ImportJobEntry>(
  source: ImportJobSource<S, E>,
  { toastService, errorMessage, translate, destroyRef }: ImportJobDependencies,
): ImportJob<S, E> {
  const toastError = catchAndToastError(toastService, errorMessage);
  const importStarting = signal(false);
  const importStatus = signal<S | null>(null);
  const importEntries = signal<E[] | null>(null);
  const entriesLoading = signal(false);
  const entriesExpanded = signal(false);

  const importActive = computed(() => isRunning(importStatus()));
  const importProgress = computed(() => {
    const status = importStatus();
    if (!status) return 0;
    const { imported, skipped, total } = source.counts(status);
    return total === 0 ? 0 : Math.round(((imported + skipped) / total) * 100);
  });
  const skippedEntries = computed(
    () => importEntries()?.filter((entry) => entry.status === 'skipped') ?? [],
  );
  const importedEntries = computed(
    () => importEntries()?.filter((entry) => entry.status === 'imported') ?? [],
  );

  function begin(start: Observable<S>): void {
    importStarting.set(true);
    importEntries.set(null);
    entriesExpanded.set(false);
    firstValueFrom(start)
      .then((status) => {
        importStarting.set(false);
        importStatus.set(status);
        poll(status.jobId);
      })
      .catch((error: unknown) => {
        importStarting.set(false);
        toastError(error);
      });
  }

  function reset(): void {
    importStatus.set(null);
    importEntries.set(null);
    entriesExpanded.set(false);
  }

  function resumeActiveImport(): void {
    firstValueFrom(source.latest())
      .then((status) => {
        importStatus.set(status);
        if (isRunning(status)) poll(status.jobId);
      })
      .catch(() => {});
  }

  function poll(jobId: string): void {
    const failed = () => toastService.error(translate.get(`${source.i18nPrefix}.import_failed`));
    interval(IMPORT_POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => source.status(jobId)),
        takeWhile((status) => isRunning(status), true),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe({
        next: (status) => {
          importStatus.set(status);
          if (status.status === 'completed') {
            const { imported, skipped } = source.counts(status);
            toastService.success(
              translate.get(`${source.i18nPrefix}.import_completed`, { imported, skipped }),
            );
          } else if (status.status === 'failed') {
            failed();
          }
        },
        error: failed,
      });
  }

  function toggleEntries(): void {
    const willExpand = !entriesExpanded();
    entriesExpanded.set(willExpand);
    if (!willExpand || importEntries() !== null) return;

    const jobId = importStatus()?.jobId;
    if (!jobId) return;

    entriesLoading.set(true);
    firstValueFrom(source.entries(jobId))
      .then((entries) => {
        entriesLoading.set(false);
        importEntries.set(entries);
      })
      .catch((error: unknown) => {
        entriesLoading.set(false);
        entriesExpanded.set(false);
        toastError(error);
      });
  }

  return {
    state: {
      importStarting: importStarting.asReadonly(),
      importStatus: importStatus.asReadonly(),
      importEntries: importEntries.asReadonly(),
      entriesLoading: entriesLoading.asReadonly(),
      entriesExpanded: entriesExpanded.asReadonly(),
      importActive,
      importProgress,
      skippedEntries,
      importedEntries,
      resumeActiveImport,
      toggleEntries,
    },
    begin,
    reset,
  };
}
