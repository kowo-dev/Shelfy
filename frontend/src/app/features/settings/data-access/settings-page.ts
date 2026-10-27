import { computed, type DestroyRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AniListService } from '@app/core/services/anilist/anilist';
import { AuthService } from '@app/core/services/auth/auth';
import { CollectionService } from '@app/core/services/collection/collection';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { LetterboxdService } from '@app/core/services/letterboxd/letterboxd';
import { SearchService } from '@app/core/services/search/search';
import { SteamService } from '@app/core/services/steam/steam';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import {
  createSettingsProfileFormState,
  type SettingsProfileFormState,
} from '../state/settings-profile-form-state';
import { createSettingsEmailState, type SettingsEmailState } from '../state/settings-email-state';
import {
  createSettingsAvatarState,
  type SettingsAvatarState,
} from '../state/settings-avatar-state';
import {
  createSettingsBannerState,
  type SettingsBannerState,
} from '../state/settings-banner-state';
import {
  createSettingsSteamImportState,
  type SettingsSteamImportState,
} from '../state/settings-steam-import-state';
import {
  createSettingsLetterboxdImportState,
  type SettingsLetterboxdImportState,
} from '../state/settings-letterboxd-import-state';
import {
  createSettingsDangerZoneState,
  type SettingsDangerZoneState,
} from '../state/settings-danger-zone-state';
import {
  createSettingsPrivacyState,
  type SettingsPrivacyState,
} from '../state/settings-privacy-state';

export interface SettingsPageDependencies {
  authService: AuthService;
  collectionService: CollectionService;
  steamService: SteamService;
  letterboxdService: LetterboxdService;
  searchService: SearchService;
  tmdb: TmdbService;
  igdb: IgdbService;
  aniList: AniListService;
  toastService: ToastService;
  errorMessage: ErrorMessageService;
  translate: TranslateService;
  fb: FormBuilder;
  route: ActivatedRoute;
  router: Router;
  destroyRef: DestroyRef;
}

export interface SettingsPageData {
  profileForm: SettingsProfileFormState;
  email: SettingsEmailState;
  avatar: SettingsAvatarState;
  banner: SettingsBannerState;
  steamImport: SettingsSteamImportState;
  letterboxdImport: SettingsLetterboxdImportState;
  dangerZone: SettingsDangerZoneState;
  privacy: SettingsPrivacyState;
}

export function createSettingsPage(dependencies: SettingsPageDependencies): SettingsPageData {
  const {
    authService,
    collectionService,
    steamService,
    letterboxdService,
    searchService,
    tmdb,
    igdb,
    aniList,
    toastService,
    errorMessage,
    translate,
    fb,
    route,
    router,
    destroyRef,
  } = dependencies;

  const currentUser = authService.currentUser();

  const profileForm = createSettingsProfileFormState({
    fb,
    authService,
    translate,
    toastService,
    errorMessage,
  });

  const email = createSettingsEmailState({
    fb,
    authService,
    toastService,
    errorMessage,
    translate,
  });

  const avatar = createSettingsAvatarState({
    authService,
    toastService,
    errorMessage,
    translate,
  });

  const banner = createSettingsBannerState({
    authService,
    searchService,
    collectionService,
    tmdb,
    igdb,
    aniList,
    toastService,
    errorMessage,
    translate,
  });

  const steamImport = createSettingsSteamImportState({
    steamService,
    authService,
    toastService,
    errorMessage,
    translate,
    destroyRef,
  });

  const letterboxdImport = createSettingsLetterboxdImportState({
    letterboxdService,
    toastService,
    errorMessage,
    translate,
    destroyRef,
  });

  const dangerZone = createSettingsDangerZoneState({
    authService,
    collectionService,
    router,
    toastService,
    errorMessage,
    translate,
    username: computed(() => authService.currentUser()?.username),
  });

  const privacy = createSettingsPrivacyState({
    authService,
    toastService,
    errorMessage,
  });

  handleSteamOAuthCallback(route, router, authService, translate, toastService);

  if (currentUser?.isSteamConnected) {
    steamImport.resumeActiveImport();
  }
  letterboxdImport.resumeActiveImport();

  return { profileForm, email, avatar, banner, steamImport, letterboxdImport, dangerZone, privacy };
}

function handleSteamOAuthCallback(
  route: ActivatedRoute,
  router: Router,
  authService: AuthService,
  translate: TranslateService,
  toastService: ToastService,
): void {
  const steamStatus = route.snapshot.queryParamMap.get('steam');
  if (steamStatus === 'connected') {
    authService
      .refreshCurrentUser()
      .then(() => toastService.success(translate.get('settings.import.steam.connected')))
      .catch(() => toastService.error(translate.get('settings.import.steam.connect_error')));
    clearQueryParam(route, router, 'steam');
  } else if (steamStatus) {
    console.error(`Steam OAuth callback failed with code: ${steamStatus}`);
    const key =
      steamStatus === 'STEAM_ALREADY_LINKED'
        ? 'settings.import.steam.connect_error_already_linked'
        : 'settings.import.steam.connect_error';
    toastService.error(translate.get(key));
    clearQueryParam(route, router, 'steam');
  }
}

function clearQueryParam(route: ActivatedRoute, router: Router, name: string): void {
  const queryParams = { ...route.snapshot.queryParams };
  delete queryParams[name];
  router.navigate([], { relativeTo: route, queryParams, replaceUrl: true });
}
