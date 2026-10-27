import { signal, type DestroyRef, type Signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@app/core/services/auth/auth';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { SteamService } from '@app/core/services/steam/steam';
import type { SteamImportEntry, SteamImportStatus } from '@app/core/services/steam/steam.model';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { createImportJob, type ImportJobState } from './import-job-state';

export interface SettingsSteamImportState extends ImportJobState<
  SteamImportStatus,
  SteamImportEntry
> {
  connecting: Signal<boolean>;
  disconnecting: Signal<boolean>;
  connect: () => void;
  disconnect: () => void;
  startImport: () => void;
}

export interface SettingsSteamImportDependencies {
  steamService: SteamService;
  authService: AuthService;
  toastService: ToastService;
  errorMessage: ErrorMessageService;
  translate: TranslateService;
  destroyRef: DestroyRef;
}

export function createSettingsSteamImportState(
  dependencies: SettingsSteamImportDependencies,
): SettingsSteamImportState {
  const { steamService, authService, toastService, errorMessage, translate } = dependencies;
  const job = createImportJob<SteamImportStatus, SteamImportEntry>(
    {
      i18nPrefix: 'settings.import.steam',
      counts: (status) => ({
        imported: status.gamesImported,
        skipped: status.gamesSkipped,
        total: status.gamesTotal,
      }),
      latest: () => steamService.getLatestImport(),
      status: (jobId) => steamService.getImportStatus(jobId),
      entries: (jobId) => steamService.getImportEntries(jobId),
    },
    dependencies,
  );

  const connecting = signal(false);
  const disconnecting = signal(false);

  function connect(): void {
    connecting.set(true);
    firstValueFrom(steamService.getAuthorizeUrl())
      .then((response) => {
        window.location.href = response.url;
      })
      .catch((error: unknown) => {
        connecting.set(false);
        catchAndToastError(toastService, errorMessage)(error);
      });
  }

  function disconnect(): void {
    disconnecting.set(true);
    firstValueFrom(steamService.disconnect())
      .then(() => authService.refreshCurrentUser())
      .then(() => {
        disconnecting.set(false);
        job.reset();
        toastService.success(translate.get('settings.import.steam.disconnected'));
      })
      .catch((error: unknown) => {
        disconnecting.set(false);
        catchAndToastError(toastService, errorMessage)(error);
      });
  }

  function startImport(): void {
    job.begin(steamService.startImport());
  }

  return {
    ...job.state,
    connecting: connecting.asReadonly(),
    disconnecting: disconnecting.asReadonly(),
    connect,
    disconnect,
    startImport,
  };
}
