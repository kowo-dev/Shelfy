import { signal, type Signal } from '@angular/core';
import { AuthService } from '@app/core/services/auth/auth';
import { AniListService } from '@app/core/services/anilist/anilist';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { CollectionService } from '@app/core/services/collection/collection';
import { SearchService } from '@app/core/services/search/search';
import { ToastService } from '@app/core/services/toast/toast';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { TranslateService } from '@app/core/services/translate/translate';
import type {
  BannerCandidate,
  BannerImage,
  BannerSelection,
} from '@shared/ui/banner-picker-dialog/banner-picker-dialog';
import { createBannerPickerState } from '@shared/ui/banner-picker-dialog/banner-picker-state';

export interface SettingsBannerState {
  pickerOpen: Signal<boolean>;
  query: Signal<string>;
  results: Signal<BannerCandidate[]>;
  shelfResults: Signal<BannerCandidate[]>;
  shelfLoading: Signal<boolean>;
  counts: Signal<Record<string, number>>;
  requestCount: (candidate: BannerCandidate) => void;
  loading: Signal<boolean>;
  loadingMore: Signal<boolean>;
  hasMore: Signal<boolean>;
  unavailableProviders: Signal<string[]>;
  selectedMedia: Signal<BannerCandidate | null>;
  images: Signal<BannerImage[]>;
  imagesLoading: Signal<boolean>;
  selectedImage: Signal<BannerImage | null>;
  imagePosition: Signal<number>;
  saving: Signal<boolean>;
  clearing: Signal<boolean>;
  pendingBanner: Signal<BannerDraft | null | undefined>;
  openPicker: () => void;
  closePicker: () => void;
  onQueryChange: (query: string) => void;
  loadMoreResults: () => void;
  selectMedia: (candidate: BannerCandidate) => void;
  backToSearch: () => void;
  selectImage: (image: BannerImage) => void;
  setImagePosition: (position: number) => void;
  confirmImage: (selection: BannerSelection) => void;
  clearBanner: () => void;
  discard: () => void;
  save: () => Promise<void>;
}

interface BannerDraft {
  bannerUrl: string;
  title: string;
  provider: string;
  sourceUrl: string;
  position: number;
}

export interface SettingsBannerDependencies {
  authService: AuthService;
  searchService: SearchService;
  collectionService?: CollectionService;
  tmdb: TmdbService;
  igdb: IgdbService;
  aniList: AniListService;
  toastService: ToastService;
  errorMessage: ErrorMessageService;
  translate: TranslateService;
}

export function createSettingsBannerState(
  dependencies: SettingsBannerDependencies,
): SettingsBannerState {
  const { authService, toastService, errorMessage } = dependencies;

  const saving = signal(false);
  const clearing = signal(false);
  const pendingBanner = signal<BannerDraft | null | undefined>(undefined);

  const picker = createBannerPickerState(dependencies, {
    onConfirm: (pick) =>
      pendingBanner.set({
        bannerUrl: pick.url,
        title: pick.media.result.title,
        provider: pick.media.result.provider,
        sourceUrl: pick.sourceUrl,
        position: pick.position,
      }),
  });

  function clearBanner(): void {
    pendingBanner.set(null);
  }

  function discard(): void {
    pendingBanner.set(undefined);
  }

  async function save(): Promise<void> {
    const banner = pendingBanner();
    if (banner === undefined || saving() || clearing()) return;

    const busy = banner ? saving : clearing;
    busy.set(true);
    try {
      if (banner) {
        await authService.updateProfileBanner(banner);
      } else {
        await authService.clearProfileBanner();
      }
      pendingBanner.set(undefined);
    } catch (error) {
      catchAndToastError(toastService, errorMessage)(error);
    } finally {
      busy.set(false);
    }
  }

  return {
    ...picker,
    saving: saving.asReadonly(),
    clearing: clearing.asReadonly(),
    pendingBanner: pendingBanner.asReadonly(),
    clearBanner,
    discard,
    save,
  };
}
