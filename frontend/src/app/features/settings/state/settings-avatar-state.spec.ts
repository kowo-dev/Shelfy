import { vi } from 'vitest';

import type { AuthService } from '@app/core/services/auth/auth';
import type { ErrorMessageService } from '@app/core/services/error-message/error-message';
import type { ToastService } from '@app/core/services/toast/toast';
import type { TranslateService } from '@app/core/services/translate/translate';

import { createSettingsAvatarState } from './settings-avatar-state';

function makeDeps(overrides: {
  uploadAvatar?: ReturnType<typeof vi.fn>;
  removeAvatar?: ReturnType<typeof vi.fn>;
}) {
  const authService = {
    uploadAvatar: overrides.uploadAvatar ?? vi.fn().mockResolvedValue(undefined),
    removeAvatar: overrides.removeAvatar ?? vi.fn().mockResolvedValue(undefined),
  } as unknown as AuthService;
  const toastService = { success: vi.fn(), error: vi.fn() } as unknown as ToastService;
  const errorMessage = {
    fromApiError: vi.fn().mockReturnValue('err'),
  } as unknown as ErrorMessageService;
  const translate = { get: vi.fn((key: string) => key) } as unknown as TranslateService;
  return { authService, toastService, errorMessage, translate };
}

function makeFile(type: string, size: number): File {
  return { type, size, name: 'f' } as File;
}

describe('createSettingsAvatarState', () => {
  beforeEach(() => {
    (globalThis as { URL: typeof URL }).URL.createObjectURL = vi
      .fn()
      .mockReturnValue('blob:preview');
    (globalThis as { URL: typeof URL }).URL.revokeObjectURL = vi.fn();
  });

  it('starts with no preview and not busy', () => {
    const deps = makeDeps({});
    const state = createSettingsAvatarState(deps);

    expect(state.uploading()).toBe(false);
    expect(state.removing()).toBe(false);
    expect(state.previewUrl()).toBeUndefined();
  });

  it('upload() rejects invalid file type', () => {
    const deps = makeDeps({});
    const state = createSettingsAvatarState(deps);

    state.upload(makeFile('text/plain', 100));

    expect(deps.toastService.error).toHaveBeenCalled();
    expect(state.previewUrl()).toBeUndefined();
  });

  it('upload() rejects files that are too large', () => {
    const deps = makeDeps({});
    const state = createSettingsAvatarState(deps);

    state.upload(makeFile('image/png', 3 * 1024 * 1024));

    expect(deps.toastService.error).toHaveBeenCalled();
    expect(state.previewUrl()).toBeUndefined();
  });

  it('upload() sets a preview url for a valid file', () => {
    const deps = makeDeps({});
    const state = createSettingsAvatarState(deps);

    state.upload(makeFile('image/png', 100));

    expect(state.previewUrl()).toBe('blob:preview');
  });

  it('remove() sets previewUrl to null', () => {
    const deps = makeDeps({});
    const state = createSettingsAvatarState(deps);

    state.upload(makeFile('image/png', 100));
    state.remove();

    expect(state.previewUrl()).toBeNull();
  });

  it('save() uploads pending file and resets preview on success', async () => {
    const deps = makeDeps({});
    const state = createSettingsAvatarState(deps);
    state.upload(makeFile('image/png', 100));

    await state.save();

    expect(deps.authService.uploadAvatar).toHaveBeenCalled();
    expect(deps.toastService.success).not.toHaveBeenCalled();
    expect(state.previewUrl()).toBeUndefined();
    expect(state.uploading()).toBe(false);
  });

  it('discard() drops a pending upload without saving', () => {
    const deps = makeDeps({});
    const state = createSettingsAvatarState(deps);
    state.upload(makeFile('image/png', 100));

    state.discard();

    expect(state.previewUrl()).toBeUndefined();
    expect(deps.authService.uploadAvatar).not.toHaveBeenCalled();
  });

  it('save() removes avatar when previewUrl is null', async () => {
    const deps = makeDeps({});
    const state = createSettingsAvatarState(deps);
    state.remove();

    await state.save();

    expect(deps.authService.removeAvatar).toHaveBeenCalled();
    expect(deps.toastService.success).not.toHaveBeenCalled();
    expect(state.previewUrl()).toBeUndefined();
    expect(state.removing()).toBe(false);
  });

  it('save() does nothing when there is no pending change', async () => {
    const deps = makeDeps({});
    const state = createSettingsAvatarState(deps);

    await state.save();

    expect(deps.authService.uploadAvatar).not.toHaveBeenCalled();
    expect(deps.authService.removeAvatar).not.toHaveBeenCalled();
  });

  it('save() shows a toast error when the upload fails', async () => {
    const deps = makeDeps({
      uploadAvatar: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const state = createSettingsAvatarState(deps);
    state.upload(makeFile('image/png', 100));

    await state.save();

    expect(deps.toastService.error).toHaveBeenCalled();
    expect(state.uploading()).toBe(false);
  });

  it('save() shows a toast error when the removal fails', async () => {
    const deps = makeDeps({
      removeAvatar: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const state = createSettingsAvatarState(deps);
    state.remove();

    await state.save();

    expect(deps.toastService.error).toHaveBeenCalled();
    expect(state.removing()).toBe(false);
  });
});
