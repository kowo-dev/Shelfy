import { signal, type Signal } from '@angular/core';
import { AuthService } from '@app/core/services/auth/auth';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ToastService } from '@app/core/services/toast/toast';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { TranslateService } from '@app/core/services/translate/translate';

const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface SettingsAvatarState {
  uploading: Signal<boolean>;
  removing: Signal<boolean>;
  previewUrl: Signal<string | null | undefined>;
  upload: (file: File) => void;
  remove: () => void;
  discard: () => void;
  save: () => Promise<void>;
}

export interface SettingsAvatarDependencies {
  authService: AuthService;
  toastService: ToastService;
  errorMessage: ErrorMessageService;
  translate: TranslateService;
}

export function createSettingsAvatarState(
  dependencies: SettingsAvatarDependencies,
): SettingsAvatarState {
  const { authService, toastService, errorMessage, translate } = dependencies;

  const uploading = signal(false);
  const removing = signal(false);
  const previewUrl = signal<string | null | undefined>(undefined);
  let pendingFile: File | null = null;
  let previewObjectUrl: string | null = null;

  function clearPreviewObjectUrl(): void {
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }

  function upload(file: File): void {
    if (uploading()) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toastService.error(translate.get('settings.avatar_banner.avatar.errors.invalid_type'));
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toastService.error(translate.get('settings.avatar_banner.avatar.errors.too_large'));
      return;
    }

    clearPreviewObjectUrl();
    pendingFile = file;
    previewObjectUrl = URL.createObjectURL(file);
    previewUrl.set(previewObjectUrl);
  }

  function remove(): void {
    if (removing()) return;

    clearPreviewObjectUrl();
    pendingFile = null;
    previewUrl.set(null);
  }

  function discard(): void {
    clearPreviewObjectUrl();
    pendingFile = null;
    previewUrl.set(undefined);
  }

  async function save(): Promise<void> {
    if (previewUrl() === undefined || uploading() || removing()) return;

    const file = pendingFile;
    if (file) {
      uploading.set(true);
      try {
        await authService.uploadAvatar(file);
        clearPreviewObjectUrl();
        previewUrl.set(undefined);
        pendingFile = null;
      } catch (error) {
        catchAndToastError(toastService, errorMessage)(error);
      } finally {
        uploading.set(false);
      }
      return;
    }

    removing.set(true);
    try {
      await authService.removeAvatar();
      clearPreviewObjectUrl();
      previewUrl.set(undefined);
    } catch (error) {
      catchAndToastError(toastService, errorMessage)(error);
    } finally {
      removing.set(false);
    }
  }

  return {
    uploading: uploading.asReadonly(),
    removing: removing.asReadonly(),
    previewUrl: previewUrl.asReadonly(),
    upload,
    remove,
    discard,
    save,
  };
}
