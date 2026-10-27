import { Location, NgTemplateOutlet } from '@angular/common';
import { PageFooterComponent } from '@shared/ui/page-footer/page-footer';
import { browseQueryParams, browseUrl } from './data-access/media-detail-links.util';
import { Title } from '@angular/platform-browser';
import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  type ElementRef,
  inject,
  Injector,
  type Signal,
  signal,
  untracked,
  viewChild,
  type WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { watchCollectionChanges } from '@shared/utils/collection-change-sync';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DetailSkeletonComponent } from '@shared/ui/detail-skeleton/detail-skeleton';
import { IconComponent } from '@shared/ui/icon/icon';
import { ImageLightboxComponent } from '@shared/ui/image-lightbox/image-lightbox';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { TranslateService } from '@app/core/services/translate/translate';
import { PageMetaService } from '@app/core/services/title/page-meta';
import type { MediaType, UserMediaStatus } from '@app/core/services/collection/collection.model';
import { AuthService } from '@app/core/services/auth/auth';
import { AddSheetService } from '@app/core/services/add-sheet/add-sheet';
import { ItemSheetService } from '@app/core/services/item-sheet/item-sheet';
import { EpisodeProgressService } from '@app/core/services/episode-progress/episode-progress';
import type { EpisodeProgress } from '@app/core/services/episode-progress/episode-progress.model';
import {
  applyEpisodes,
  applyRating,
} from '@app/core/services/episode-progress/episode-progress.util';
import type { Observable } from 'rxjs';
import type { EpisodeCell } from './tracker/episode-grid.util';
import { formatRating } from '@shared/utils/collection-rating.util';
import { statusAfterRating } from '@shared/utils/rating-status.util';
import { statusLabelKey } from '@shared/utils/collection-status.util';
import { WatchLogService } from '@app/core/services/watch-log/watch-log';
import type { WatchLogEntry } from '@app/core/services/watch-log/watch-log.model';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { ToastService } from '@app/core/services/toast/toast';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { AniListService } from '@app/core/services/anilist/anilist';
import { CollectionService } from '@app/core/services/collection/collection';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { WatchLogTimelineComponent } from '@shared/ui/watch-log/watch-log-timeline';
import { mediaLogKind } from '@shared/utils/media-log-kind.util';
import { UserProfileService } from '@app/core/services/users/user-profile';
import type { ReviewResponse } from '@app/core/services/users/user-profile.model';
import { ItemEditorComponent } from '@shared/ui/item-editor/item-editor';
import { ShelfSectionComponent } from '@shared/ui/shelf-section/shelf-section';
import { TabsComponent, type TabItem } from '@shared/ui/tabs/tabs';
import { MediaDetailMetadataComponent } from './ui/media-detail-metadata/media-detail-metadata';
import { MediaDetailCastComponent } from './ui/media-detail-cast/media-detail-cast';
import { MediaDetailCharactersComponent } from './ui/media-detail-characters/media-detail-characters';
import { MediaDetailCategoriesComponent } from './ui/media-detail-categories/media-detail-categories';
import { MediaDetailAvailabilityComponent } from './ui/media-detail-availability/media-detail-availability';
import { MediaDetailReviewsComponent } from './ui/media-detail-reviews/media-detail-reviews';
import { MediaDetailGalleryComponent } from './ui/media-detail-gallery/media-detail-gallery';
import { MediaDetailGameStripComponent } from './ui/media-detail-game-strip/media-detail-game-strip';
import { MediaDetailRelatedComponent } from './ui/media-detail-related/media-detail-related';
import { RailSkeletonComponent } from '@shared/ui/rail-skeleton/rail-skeleton';
import { createMediaDetailPage } from './data-access/media-detail-page';
import { FriendActivityComponent } from './ui/friend-activity/friend-activity';
import { EpisodesOverviewComponent } from './ui/episodes-overview/episodes-overview';
import { injectEpisodeColumns } from './tracker/episode-columns';
import { externalSource, releasedNeighbours } from './tracker/episode-grid.util';
import { EpisodeSheetComponent } from './tracker/ui/episode-sheet';
import {
  buildMediaDetailView,
  NUMERIC_ID_TYPES,
  type DetailMediaType,
} from './data-access/media-detail-view.util';
import {
  buildCatalogRating,
  buildMediaFacts,
  formatRuntime,
} from './data-access/media-detail-stats.util';
import type { CatalogRating } from './data-access/media-detail-stats.util';
import { ButtonComponent, buttonClasses } from '@shared/ui/button/button';
import { EmptyStateComponent } from '@shared/ui/empty-state/empty-state';

function providerForMediaType(type: DetailMediaType): string {
  return type === 'movie' || type === 'tv_show' ? 'tmdb' : type === 'game' ? 'igdb' : 'anilist';
}

import {
  isEpisodic,
  nextAction,
  nextActionIcon,
  nextActionLabel,
  nextEpisode,
  type NextAction,
  type NextEpisode,
} from '@shared/utils/next-action.util';

@Component({
  selector: 'shelfy-media-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageFooterComponent,
    ButtonComponent,
    NgTemplateOutlet,
    DetailSkeletonComponent,
    EmptyStateComponent,
    FriendActivityComponent,
    EpisodesOverviewComponent,
    EpisodeSheetComponent,
    IconComponent,
    ImageLightboxComponent,
    ItemEditorComponent,
    ShelfSectionComponent,
    TabsComponent,
    TranslatePipe,
    MediaDetailMetadataComponent,
    MediaDetailCastComponent,
    MediaDetailCharactersComponent,
    MediaDetailCategoriesComponent,
    MediaDetailAvailabilityComponent,
    MediaDetailReviewsComponent,
    MediaDetailGalleryComponent,
    MediaDetailGameStripComponent,
    MediaDetailRelatedComponent,
    RailSkeletonComponent,
    WatchLogTimelineComponent,
    RouterLink,
  ],
  templateUrl: './media-detail.html',
})
export class MediaDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly documentTitle = inject(Title);
  private readonly pageMeta = inject(PageMetaService);
  private readonly tmdb = inject(TmdbService);
  private readonly igdb = inject(IgdbService);
  private readonly aniList = inject(AniListService);
  private readonly collectionService = inject(CollectionService);
  private readonly userProfileService = inject(UserProfileService);
  private readonly toastService = inject(ToastService);
  private readonly errorMessage = inject(ErrorMessageService);
  private readonly translate = inject(TranslateService);
  private readonly itemSheet = inject(ItemSheetService);
  private readonly addSheet = inject(AddSheetService);
  readonly signedIn = inject(AuthService).isAuthenticated;
  private readonly watchLog = inject(WatchLogService);
  private readonly episodes = inject(EpisodeProgressService);
  private readonly dateFormat = inject(DateFormatService);
  private readonly confirm = inject(ConfirmService);

  protected readonly browseUrl = browseUrl;
  protected readonly browseQueryParams = browseQueryParams;
  readonly moreLink =
    'text-text mt-1.5 cursor-pointer text-base font-semibold underline-offset-3 hover:underline';
  readonly historyPreview = 3;
  readonly genreLimit = 3;
  readonly storylineExpanded = signal(false);
  readonly storylineClamped = signal(false);
  private readonly storylineText = viewChild<ElementRef<HTMLElement>>('storylineText');
  readonly overviewExpanded = signal(false);
  readonly overviewClamped = signal(false);
  private readonly overviewText = viewChild<ElementRef<HTMLElement>>('overviewText');

  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  readonly mediaType = computed(() => this.params().get('mediaType') as DetailMediaType);
  readonly provider = computed(() => providerForMediaType(this.mediaType()));
  readonly externalId = computed<number | string>(() => {
    const raw = this.params().get('externalId') ?? '';
    return NUMERIC_ID_TYPES.has(this.mediaType()) ? Number(raw) : raw;
  });

  readonly trackerRoute = computed(() => [
    '/media',
    this.mediaType(),
    String(this.externalId()),
    'episodes',
  ]);

  readonly hasEpisodes = computed(
    () => this.mediaType() === 'tv_show' || this.mediaType() === 'anime',
  );
  readonly loadFailed = signal(false);
  private readonly toastError = catchAndToastError(this.toastService, this.errorMessage);

  private readonly page = createMediaDetailPage(
    (error) => {
      this.loadFailed.set(true);
      this.toastError(error);
    },
    {
      tmdb: this.tmdb,
      igdb: this.igdb,
      aniList: this.aniList,
      collectionService: this.collectionService,
    },
  );

  readonly loading = this.page.loading;
  readonly tvShow = this.page.tvShow;
  readonly game = this.page.game;
  readonly collectionItem = this.page.collectionItem;
  readonly reviews = signal<ReviewResponse[]>([]);

  readonly isOnShelf = computed(() => this.collectionItem() !== null);

  readonly selectedImageIndex = signal<number | null>(null);

  readonly detailsExpanded = signal(false);

  readonly shelvedItem = computed(() => (this.isOnShelf() ? this.collectionItem() : null));

  protected readonly primaryButton = buttonClasses({ variant: 'primary', extraClass: 'gap-2.5' });
  protected readonly removeButton = buttonClasses({ variant: 'danger', iconOnly: true });
  protected readonly secondaryButton = buttonClasses({
    variant: 'secondary',
    extraClass: 'gap-2.5',
  });
  readonly next = computed<NextEpisode | null>(() =>
    this.shelvedItem()?.status === 'ongoing' ? nextEpisode(this.episodeProgress()) : null,
  );
  readonly action = computed<NextAction | null>(() =>
    nextAction(
      this.shelvedItem()?.status ?? null,
      isEpisodic(this.mediaType() as MediaType),
      this.next(),
    ),
  );
  readonly actionLabel = computed(() => {
    this.translate.lang();
    return nextActionLabel(
      this.action(),
      this.mediaType() as MediaType,
      this.next(),
      (key, params) => this.translate.get(key, params),
    );
  });
  readonly actionIcon = computed(() => nextActionIcon(this.action()));
  readonly editorType = computed(() => this.mediaType() as MediaType);
  private readonly barSentinel = viewChild<ElementRef<HTMLElement>>('barSentinel');
  readonly stuck = signal(false);
  private readonly spied = signal<string | null>(null);
  readonly factGenres = computed(() => this.view().genres.slice(0, 2));
  readonly seasonsLabel = computed(() => {
    this.translate.lang();
    const seasons = this.view().numberOfSeasons;
    return seasons
      ? this.translate.get(seasons === 1 ? 'media.meta.seasons_one' : 'media.meta.seasons_other', {
          count: seasons,
        })
      : null;
  });
  readonly runtimeLabel = computed(() => {
    const runtime = this.view().runtime;
    return runtime ? formatRuntime(runtime) : null;
  });

  goToSection(id: string): void {
    this.spied.set(id);
    document.getElementById('sec-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  openReview(): void {
    const link = this.reviewLink();
    void this.router.navigate(link.commands, { queryParams: link.queryParams });
  }

  private spySections(): void {
    const sentinel = this.barSentinel()?.nativeElement;
    if (!sentinel) return;
    const nav =
      window.innerWidth >= 768
        ? parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--nav-bar-height'),
          ) || 76
        : 0;
    this.stuck.set(sentinel.getBoundingClientRect().top < nav - 0.5);
    const line = nav + 160;
    let current: string | null = null;
    for (const tab of this.sectionTabs()) {
      const top = document.getElementById('sec-' + tab.id)?.getBoundingClientRect().top;
      if (top !== undefined && top <= line) current = tab.id;
    }
    this.spied.set(current);
  }

  runAction(): void {
    const action = this.action();
    if (action === 'shelve') this.setStatus('planned');
    else if (action === 'start' || action === 'resume') this.setStatus('ongoing');
    else if (action === 'finish') this.setStatus('done');
    else if (action === 'episode') {
      const next = this.next();
      if (next) this.markEpisode(next.season, next.number);
    }
  }

  markEpisode(season: number, episode: number): void {
    const request = { season, episodes: [episode], isWatched: true };
    this.mutateEpisodes(
      (progress) => applyEpisodes(progress, request),
      (id) => this.episodes.update(id, request),
    );
  }

  readonly reviewLabel = computed(() =>
    this.shelvedItem()?.note ? 'collection.sheet.edit_review' : 'collection.sheet.write_review',
  );
  readonly reviewLink = computed(() => {
    const item = this.shelvedItem();
    if (item) return { commands: ['/reviews', item.id, 'edit'], queryParams: {} };
    const cover = this.view().posterUrl;
    return {
      commands: ['/reviews/new'],
      queryParams: {
        provider: this.provider(),
        mediaType: this.mediaType(),
        externalId: String(this.externalId()),
        title: this.view().title ?? '',
        ...(cover ? { cover } : {}),
      },
    };
  });

  readonly scores = computed(() => {
    const external = this.catalogRating();
    if (!external?.value) return [];
    const votes = external.votes
      ? ' ' +
        this.translate.get('media.page.votes', {
          count: external.votes.toLocaleString(this.translate.lang()),
        })
      : '';
    return [{ text: formatRating(external.value), label: external.label + votes }];
  });

  readonly visibleGalleryImages = computed(() => this.view().galleryImages.slice(0, 6));
  readonly previewImages = computed(() => {
    const poster = this.view().posterUrl;
    const gallery = this.visibleGalleryImages();
    return poster ? [poster, ...gallery.filter((image) => image !== poster)] : gallery;
  });

  readonly view = computed(() =>
    buildMediaDetailView(
      this.mediaType(),
      {
        movie: this.page.movie(),
        tvShow: this.page.tvShow(),
        game: this.page.game(),
        animeDetail: this.page.animeDetail(),
        mangaDetail: this.page.mangaDetail(),
      },
      { tmdb: this.tmdb, igdb: this.igdb },
    ),
  );

  readonly catalogRating = computed<CatalogRating | null>(() => {
    this.translate.lang();
    return buildCatalogRating(this.mediaType(), this.view(), this.translate);
  });

  readonly facts = computed(() => {
    this.translate.lang();
    return buildMediaFacts(this.view(), this.translate, (iso) =>
      this.dateFormat.formatDate(
        new Date(`${iso.slice(0, 10)}T12:00:00`),
        this.translate.lang(),
        'long',
      ),
    );
  });

  readonly history = signal<WatchLogEntry[] | null>(null);
  readonly sectionTabs = computed<TabItem[]>(() => {
    this.translate.lang();
    const view = this.view();
    const tab = (id: string, key: string, shown = true): TabItem | null =>
      shown ? { id, label: this.translate.get(key) } : null;
    return [
      tab('details', 'media.sections.information'),
      tab('episodes', 'media.page.episodes', this.episodeColumns().length > 0),
      tab(
        'history',
        'media.history.section',
        this.isOnShelf() && (this.history()?.length ?? 0) > 0,
      ),
      tab('visuals', 'media.visuals', this.visibleGalleryImages().length > 0),
      tab(
        'cast',
        'media.cast',
        view.cast.length + view.animeCharacters.length + view.mangaCharacters.length > 0,
      ),
      tab('reviews', 'media.page.reviews'),
      tab('similar', 'media.related.similar'),
    ].filter((item): item is TabItem => item !== null);
  });
  readonly activeSection = computed(() => this.spied() ?? this.sectionTabs()[0]?.id ?? '');
  readonly episodeProgress = signal<EpisodeProgress | null>(null);
  private readonly episodeData = injectEpisodeColumns({
    mediaType: this.mediaType,
    externalId: this.externalId,
    tvShow: this.page.tvShow,
    animeDetail: this.page.animeDetail,
    progress: this.episodeProgress,
  });
  readonly episodeColumns = this.episodeData.columns;
  readonly episodeSource = computed(() => externalSource(this.episodeColumns()));
  readonly openedKey = signal<string | null>(null);
  readonly openedEpisode = computed(() => {
    const key = this.openedKey();
    if (!key) return null;
    const [season, episode] = key.split(':').map(Number);
    return (
      this.episodeColumns()
        .find((c) => c.season === season)
        ?.episodes.find((e) => e.episode === episode) ?? null
    );
  });
  readonly episodeNeighbours = computed(() => {
    const cell = this.openedEpisode();
    return cell ? releasedNeighbours(this.episodeColumns(), cell) : { previous: null, next: null };
  });
  private readonly collectionItemId = computed(() => this.collectionItem()?.id ?? null);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const scroller = document.querySelector('.app-main') ?? window;
      const onScroll = () => this.spySections();
      scroller.addEventListener('scroll', onScroll, { passive: true });
      destroyRef.onDestroy(() => scroller.removeEventListener('scroll', onScroll));
    });
    this.bindSheets();
    this.bindCollectionItem();
    this.bindDocumentMeta();
    this.bindClamp(this.storylineText, this.storylineExpanded, this.storylineClamped);
    this.bindClamp(this.overviewText, this.overviewExpanded, this.overviewClamped);
    effect(() => {
      this.loadFailed.set(false);
      this.page.load(this.mediaType(), this.externalId());
      this.refreshReviews();
    });
    const injector = inject(Injector);
    effect(() => {
      if (this.loading()) this.shelfMotion.set(false);
      else afterNextRender(() => this.shelfMotion.set(true), { injector });
    });
  }

  private bindSheets(): void {
    this.addSheet.added.pipe(takeUntilDestroyed()).subscribe((item) => this.onSheetAdded(item));
    this.itemSheet.updated.pipe(takeUntilDestroyed()).subscribe((updated) => {
      if (this.collectionItem()?.id !== updated.id) return;
      this.onItemUpdated(updated);
      if (this.hasEpisodes()) this.loadEpisodes(updated.id);
    });
    inject(DestroyRef).onDestroy(() => this.itemSheet.close());
  }

  private bindCollectionItem(): void {
    watchCollectionChanges(this.collectionService, inject(Injector), {
      onUpdated: (item) => {
        if (item.id !== this.collectionItemId()) return;
        this.loadHistory(item.id);
        this.collectionItem.set(item);
        this.refreshReviews();
      },
      onRemoved: (id) => {
        if (id === this.collectionItemId()) this.collectionItem.set(null);
      },
      onCleared: () => this.collectionItem.set(null),
    });
    effect(() => {
      const id = this.collectionItemId();
      untracked(() => {
        this.history.set(null);
        this.episodeProgress.set(null);
        if (id) {
          this.loadHistory(id);
          if (this.hasEpisodes()) this.loadEpisodes(id);
        }
      });
    });
  }

  private bindDocumentMeta(): void {
    effect(() => {
      const { title, overview } = this.view();
      if (!title) return;
      this.documentTitle.setTitle(`${title} · Shelfy`);
      this.pageMeta.setTitle(title);
      this.pageMeta.setDescription(overview);
    });
  }

  private bindClamp(
    text: Signal<ElementRef<HTMLElement> | undefined>,
    expanded: WritableSignal<boolean>,
    clamped: WritableSignal<boolean>,
  ): void {
    afterRenderEffect(() => {
      const el = text()?.nativeElement;
      this.view();
      if (el && !expanded()) clamped.set(el.scrollHeight > el.clientHeight + 1);
    });
    effect(() => {
      this.view();
      untracked(() => expanded.set(false));
    });
  }

  refreshReviews(): void {
    this.userProfileService
      .getMediaReviews(
        providerForMediaType(this.mediaType()),
        this.mediaType(),
        String(this.externalId()),
      )
      .subscribe({
        next: (reviews) => this.reviews.set(reviews),
        error: () => this.reviews.set([]),
      });
  }

  retryLoad(): void {
    this.loadFailed.set(false);
    this.page.load(this.mediaType(), this.externalId());
  }

  readonly removing = signal(false);
  private readonly shelfMotion = signal(false);
  readonly collapseIn = computed(() => (this.shelfMotion() ? 'animate-collapse-in' : ''));
  readonly collapseOut = computed(() => (this.shelfMotion() ? 'animate-collapse-out' : ''));
  protected readonly collapseBody =
    'min-h-0 min-w-0 [.animate-collapse-in>&]:overflow-hidden [.animate-collapse-out>&]:overflow-hidden';

  removeLabel(item: CollectionItemResponse): string {
    return item.status === 'planned'
      ? 'collection.sheet.remove_backlog'
      : 'collection.sheet.remove';
  }

  async removeFromShelf(item: CollectionItemResponse): Promise<void> {
    const backlog = item.status === 'planned';
    const confirmed = await this.confirm.ask(
      this.translate.get('collection.delete_confirm_message', { title: this.view().title ?? '' }),
      {
        title: this.translate.get('collection.delete_confirm_title'),
        confirmLabel: this.translate.get('collection.delete'),
        cancelLabel: this.translate.get('collection.cancel'),
        destructive: true,
      },
    );
    if (!confirmed) return;
    this.removing.set(true);
    this.collectionService.remove(item.id).subscribe({
      next: () => {
        this.removing.set(false);
        this.collectionItem.set(null);
        this.toastService.success(
          this.translate.get(backlog ? 'collection.backlog.removed' : 'collection.removed'),
        );
      },
      error: (error: unknown) => {
        this.removing.set(false);
        this.toastError(error);
      },
    });
  }

  setStatus(status: UserMediaStatus): void {
    const item = this.shelvedItem();
    const title = this.view().title ?? '';
    if (!item) {
      this.collectionService
        .create({
          provider: this.provider(),
          mediaType: this.mediaType() as MediaType,
          externalId: String(this.externalId()),
          status,
        })
        .subscribe({
          next: (created) => {
            this.collectionItem.set(created);
            this.loadHistory(created.id);
            this.toastService.success(this.translate.get('collection.added'));
          },
          error: this.toastError,
        });
      return;
    }
    if (status === item.status) return;
    this.collectionService.update(item.id, { status }).subscribe({
      next: (updated) => {
        this.loadHistory(updated.id);
        this.collectionItem.set(updated);
        this.toastService.success(
          this.translate.get('collection.toast_status', {
            title,
            status: this.translate.get(statusLabelKey(status, this.mediaType())),
          }),
        );
      },
      error: this.toastError,
    });
  }

  rate(rating: number | null): void {
    const item = this.shelvedItem();
    const status = statusAfterRating(item?.status ?? null, rating);
    const title = this.view().title ?? '';
    const toast = () =>
      this.toastService.success(
        rating === null
          ? this.translate.get('collection.toast_rating_cleared', { title })
          : this.translate.get('collection.toast_rated', { title, rating: formatRating(rating) }),
      );
    if (!item) {
      if (rating === null) return;
      this.collectionService
        .create({
          provider: this.provider(),
          mediaType: this.mediaType() as MediaType,
          externalId: String(this.externalId()),
          status: status ?? 'planned',
          rating,
        })
        .subscribe({
          next: (created) => {
            this.collectionItem.set(created);
            this.loadHistory(created.id);
            toast();
          },
          error: this.toastError,
        });
      return;
    }
    if (rating === item.rating) return;
    const nextStatus = status && status !== item.status ? status : undefined;
    this.collectionService
      .update(item.id, {
        ...(rating === null ? { clearRating: true } : { rating }),
        ...(nextStatus && { status: nextStatus }),
      })
      .subscribe({
        next: (updated) => {
          if (updated.status !== item.status) this.loadHistory(updated.id);
          this.collectionItem.set(updated);
          toast();
        },
        error: this.toastError,
      });
  }

  private onSheetAdded(item: CollectionItemResponse): void {
    if (item.media.externalId !== String(this.externalId())) return;
    this.collectionItem.set(item);
  }

  readonly historyExpanded = signal(false);
  readonly historyKind = computed(() => mediaLogKind(this.mediaType()));

  private loadHistory(id: string): void {
    this.watchLog.list(id).subscribe({
      next: (entries) => this.history.set(entries),
      error: () => this.history.set(null),
    });
  }

  private loadEpisodes(id: string): void {
    this.episodes.get(id).subscribe({
      next: (progress) => this.episodeProgress.set(progress),
      error: () => this.episodeProgress.set(null),
    });
  }

  openEpisode(cell: EpisodeCell): void {
    this.openedKey.set(`${cell.season}:${cell.episode}`);
  }

  stepEpisode(direction: -1 | 1): void {
    const { previous, next } = this.episodeNeighbours();
    const target = direction === -1 ? previous : next;
    if (target) this.openEpisode(target);
  }

  rateEpisode(cell: EpisodeCell, rating: number | null): void {
    const request = { season: cell.season, episode: cell.episode, rating };
    this.mutateEpisodes(
      (progress) => applyRating(progress, request),
      (id) => this.episodes.rate(id, request),
    );
  }

  setEpisodeWatched(cell: EpisodeCell, watched: boolean): void {
    const request = { season: cell.season, episodes: [cell.episode], isWatched: watched };
    this.mutateEpisodes(
      (progress) => applyEpisodes(progress, request),
      (id) => this.episodes.update(id, request),
    );
  }

  private mutateEpisodes(
    local: (progress: EpisodeProgress) => EpisodeProgress,
    remote: (itemId: string) => Observable<EpisodeProgress>,
  ): void {
    const id = this.collectionItemId();
    const before = this.episodeProgress();
    if (!id || !before) return;
    this.episodeProgress.set(local(before));
    remote(id).subscribe({
      next: (progress) => {
        this.episodeProgress.set(progress);
        if (progress.status !== this.collectionItem()?.status) {
          this.collectionService
            .refreshItem(id)
            .subscribe({ next: (item) => this.collectionItem.set(item) });
        }
      },
      error: (error: unknown) => {
        this.loadEpisodes(id);
        this.toastError(error);
      },
    });
  }

  openLogAdd(): void {
    const id = this.collectionItemId();
    if (id) void this.router.navigate(['/reviews', id, 'log']);
  }

  openLogEdit(entry: WatchLogEntry): void {
    const id = this.collectionItemId();
    if (id) void this.router.navigate(['/reviews', id, 'log', entry.id]);
  }

  onItemUpdated(updated: CollectionItemResponse): void {
    this.collectionItem.set(updated);
  }

  openImagePreview(image: string): void {
    const index = this.previewImages().indexOf(image);
    if (index !== -1) {
      this.selectedImageIndex.set(index);
    }
  }

  closeImagePreview(): void {
    this.selectedImageIndex.set(null);
  }
}
