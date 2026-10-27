import { TestBed } from '@angular/core/testing';
import { DestroyRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import type { AuthService } from '@app/core/services/auth/auth';
import type { User } from '@app/core/services/auth/auth.model';
import type { CollectionService } from '@app/core/services/collection/collection';
import type { ErrorMessageService } from '@app/core/services/error-message/error-message';
import type { SteamService } from '@app/core/services/steam/steam';
import type { LetterboxdService } from '@app/core/services/letterboxd/letterboxd';
import type { SearchService } from '@app/core/services/search/search';
import type { TmdbService } from '@app/core/services/tmdb/tmdb';
import type { IgdbService } from '@app/core/services/igdb/igdb';
import type { AniListService } from '@app/core/services/anilist/anilist';
import type { ToastService } from '@app/core/services/toast/toast';
import type { TranslateService } from '@app/core/services/translate/translate';

import { createSettingsPage, type SettingsPageDependencies } from './settings-page';

const USER = { username: 'kowo', isSteamConnected: false } as User;

function makeDeps(overrides: {
  currentUser?: User | null;
  steamParam?: string | null;
  refreshCurrentUser?: ReturnType<typeof vi.fn>;
}): { deps: SettingsPageDependencies; router: Router } {
  const fb = TestBed.inject(FormBuilder);
  const destroyRef = TestBed.inject(DestroyRef);
  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const authService = {
    currentUser: vi
      .fn()
      .mockReturnValue(overrides.currentUser === undefined ? USER : overrides.currentUser),
    checkUsernameAvailability: vi.fn().mockReturnValue(of({ isAvailable: true })),
    updateProfile: vi.fn().mockResolvedValue(undefined),
    refreshCurrentUser: overrides.refreshCurrentUser ?? vi.fn().mockResolvedValue(undefined),
  } as unknown as AuthService;

  const route = {
    snapshot: {
      queryParamMap: convertToParamMap(
        overrides.steamParam !== undefined && overrides.steamParam !== null
          ? { steam: overrides.steamParam }
          : {},
      ),
      queryParams: {},
    },
  } as unknown as ActivatedRoute;

  const deps: SettingsPageDependencies = {
    authService,
    collectionService: {} as CollectionService,
    steamService: { getLatestImport: vi.fn().mockReturnValue(of(null)) } as unknown as SteamService,
    letterboxdService: {
      getLatestImport: vi.fn().mockReturnValue(of(null)),
    } as unknown as LetterboxdService,
    searchService: {} as SearchService,
    tmdb: {} as TmdbService,
    igdb: {} as IgdbService,
    aniList: {} as AniListService,
    toastService: { success: vi.fn(), error: vi.fn() } as unknown as ToastService,
    errorMessage: {
      fromApiError: vi.fn().mockReturnValue('err'),
    } as unknown as ErrorMessageService,
    translate: { get: vi.fn((key: string) => key) } as unknown as TranslateService,
    fb,
    route,
    router,
    destroyRef,
  };

  return { deps, router };
}

function create(deps: SettingsPageDependencies) {
  return TestBed.runInInjectionContext(() => createSettingsPage(deps));
}

describe('createSettingsPage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('wires all sub-states together', () => {
    const { deps } = makeDeps({});
    const page = create(deps);

    expect(page.profileForm).toBeDefined();
    expect(page.email).toBeDefined();
    expect(page.avatar).toBeDefined();
    expect(page.banner).toBeDefined();
    expect(page.steamImport).toBeDefined();
    expect(page.letterboxdImport).toBeDefined();
    expect(page.dangerZone).toBeDefined();
    expect(page.privacy).toBeDefined();
  });

  it('does not resume a steam import when the user is not steam-connected', () => {
    const { deps } = makeDeps({ currentUser: { ...USER, isSteamConnected: false } });
    const steamService = deps.steamService as unknown as {
      getLatestImport: ReturnType<typeof vi.fn>;
    };

    create(deps);

    expect(steamService.getLatestImport).not.toHaveBeenCalled();
  });

  it('resumes a steam import when the user is steam-connected', () => {
    const { deps } = makeDeps({ currentUser: { ...USER, isSteamConnected: true } });
    const steamService = deps.steamService as unknown as {
      getLatestImport: ReturnType<typeof vi.fn>;
    };

    create(deps);

    expect(steamService.getLatestImport).toHaveBeenCalled();
  });

  it('always resumes a letterboxd import', () => {
    const { deps } = makeDeps({});
    const letterboxdService = deps.letterboxdService as unknown as {
      getLatestImport: ReturnType<typeof vi.fn>;
    };

    create(deps);

    expect(letterboxdService.getLatestImport).toHaveBeenCalled();
  });

  it('refreshes the user and shows a success toast on a successful steam callback', async () => {
    const { deps, router } = makeDeps({ steamParam: 'connected' });

    create(deps);
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.authService.refreshCurrentUser).toHaveBeenCalled();
    expect(deps.toastService.success).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({ replaceUrl: true }));
  });

  it('shows an error toast when the steam refresh fails', async () => {
    const { deps } = makeDeps({
      steamParam: 'connected',
      refreshCurrentUser: vi.fn().mockRejectedValue(new Error('boom')),
    });

    create(deps);
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.toastService.error).toHaveBeenCalled();
  });

  it('shows an already-linked error message for STEAM_ALREADY_LINKED', () => {
    const { deps } = makeDeps({ steamParam: 'STEAM_ALREADY_LINKED' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    create(deps);

    expect(deps.toastService.error).toHaveBeenCalledWith(
      'settings.import.steam.connect_error_already_linked',
    );
    errorSpy.mockRestore();
  });

  it('shows a generic connect error for other steam failure codes', () => {
    const { deps } = makeDeps({ steamParam: 'UNKNOWN_ERROR' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    create(deps);

    expect(deps.toastService.error).toHaveBeenCalledWith('settings.import.steam.connect_error');
    errorSpy.mockRestore();
  });

  it('does nothing steam-related when there is no steam query param', () => {
    const { deps } = makeDeps({ steamParam: null });

    create(deps);

    expect(deps.toastService.success).not.toHaveBeenCalled();
    expect(deps.toastService.error).not.toHaveBeenCalled();
  });
});
