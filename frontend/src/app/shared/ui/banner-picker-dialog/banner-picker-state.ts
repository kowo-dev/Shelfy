import { signal, type Signal } from '@angular/core';
import { AniListService } from '@app/core/services/anilist/anilist';
import { CollectionService } from '@app/core/services/collection/collection';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { SearchService } from '@app/core/services/search/search';
import { ToastService } from '@app/core/services/toast/toast';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import type { BannerCandidate, BannerImage, BannerSelection } from './banner-picker-dialog';
import { createBannerSearch } from './banner-search';
import { createBannerCounts, createBannerSelection } from './banner-selection';
import { createBannerSources, mediaSourceUrl } from './banner-sources';

type BannerScope = 'catalog' | 'shelf';

export interface BannerPick extends BannerSelection {
  media: BannerCandidate;
  sourceUrl: string;
}

export interface BannerPickerState {
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
  openPicker: () => void;
  closePicker: () => void;
  onQueryChange: (query: string) => void;
  loadMoreResults: () => void;
  selectMedia: (candidate: BannerCandidate) => void;
  backToSearch: () => void;
  selectImage: (image: BannerImage) => void;
  setImagePosition: (position: number) => void;
  confirmImage: (selection: BannerSelection) => void;
}

export interface BannerPickerDependencies {
  searchService?: SearchService;
  collectionService?: CollectionService;
  tmdb: TmdbService;
  igdb: IgdbService;
  aniList: AniListService;
  toastService: ToastService;
  errorMessage: ErrorMessageService;
}

export interface BannerPickerOptions {
  scope?: BannerScope;
  onConfirm: (pick: BannerPick) => void;
}

export function createBannerPickerState(
  dependencies: BannerPickerDependencies,
  options: BannerPickerOptions,
): BannerPickerState {
  const { toastService, errorMessage } = dependencies;
  const sources = createBannerSources(dependencies);
  const counts = createBannerCounts(sources.imagesForMedia);
  const onError = catchAndToastError(toastService, errorMessage);
  const selection = createBannerSelection(
    { imagesForMedia: sources.imagesForMedia, onError },
    counts.record,
  );
  const search = createBannerSearch({
    ...dependencies,
    scope: options.scope ?? 'catalog',
    coverUrl: sources.coverUrl,
    onQueryEdited: () => {
      if (selection.selectedMedia()) selection.state.backToSearch();
    },
  });
  const pickerOpen = signal(false);

  function closePicker(): void {
    pickerOpen.set(false);
    search.reset();
    selection.reset();
  }

  return {
    ...search.state,
    ...selection.state,
    pickerOpen: pickerOpen.asReadonly(),
    counts: counts.counts,
    requestCount: counts.request,
    openPicker: () => {
      pickerOpen.set(true);
      void search.loadShelf();
    },
    closePicker,
    confirmImage: (picked: BannerSelection) => {
      const media = selection.selectedMedia();
      if (!media) return;
      options.onConfirm({ ...picked, media, sourceUrl: mediaSourceUrl(media.result) });
      closePicker();
    },
  };
}
