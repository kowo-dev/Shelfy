import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  COLLECTION_STATUSES,
  countsForStatuses,
  statusLabelKey,
} from '@shared/utils/collection-status.util';
import type {
  CollectionItemResponse,
  CollectionSortBy,
  CollectionSortDirection,
  MediaType,
  UserMediaStatus,
} from '@app/core/services/collection/collection.model';
import { LayoutService } from '@app/core/services/layout/layout';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import { TabsComponent } from '@shared/ui/tabs/tabs';
import { SpinnerComponent } from '@shared/ui/spinner/spinner';
import { ButtonComponent, buttonClasses } from '@shared/ui/button/button';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { UserProfileService } from '@app/core/services/users/user-profile';
import { CollectionService } from '@app/core/services/collection/collection';
import { LocalStorageService } from '@app/core/services/local-storage/local-storage';
import { AuthService } from '@app/core/services/auth/auth';
import { AddSheetService } from '@app/core/services/add-sheet/add-sheet';
import { PageHeroComponent } from '@shared/ui/page-hero/page-hero';
import { createShelfBackdrop } from '../collection/state/collection-banner-state';
import { LibraryFiltersComponent } from '../collection/ui/library-filters/library-filters';
import { LibrarySortComponent } from '../collection/ui/library-sort/library-sort';
import { AmbientService } from '@app/core/services/ambient/ambient';
import { TranslateService } from '@app/core/services/translate/translate';
import { MediaCardComponent } from '@shared/ui/media-card/media-card';
import { FilterPanelComponent } from '@shared/ui/filter-panel/filter-panel';
import { PageFooterComponent } from '@shared/ui/page-footer/page-footer';
import { formatRating } from '@shared/utils/collection-rating.util';
import { createPosterWall } from '@shared/utils/poster-wall.util';
import {
  FILTER_GROUP_TITLE,
  FILTER_TILE,
  FILTER_TILE_OFF,
  FILTER_TILE_ON,
} from '@shared/ui/ui-recipes';
import { createFriendProfilePage } from './data-access/friend-profile-page';
import { createFriendProfileState } from './state/friend-profile-state';
import { shelfStats } from './data-access/friend-profile-stats.util';

const SEARCH_DEBOUNCE_MS = 250;

@Component({
  selector: 'shelfy-friend-profile-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TabsComponent,
    TranslatePipe,
    IconComponent,
    RouterLink,
    SpinnerComponent,
    ButtonComponent,
    PageHeroComponent,
    LibraryFiltersComponent,
    LibrarySortComponent,
    MediaCardComponent,
    FilterPanelComponent,
    PageFooterComponent,
  ],
  templateUrl: './friend-profile.html',
  host: { class: 'block h-full' },
})
export class FriendProfilePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly userProfileService = inject(UserProfileService);
  private readonly collectionService = inject(CollectionService);
  private readonly localStorage = inject(LocalStorageService);
  private readonly toastService = inject(ToastService);
  private readonly errorMessage = inject(ErrorMessageService);
  private readonly ambient = inject(AmbientService);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);
  private readonly addSheet = inject(AddSheetService);
  private readonly layout = inject(LayoutService);

  readonly notFoundLink = buttonClasses({ variant: 'secondary' });
  protected readonly groupTitle = FILTER_GROUP_TITLE;

  readonly scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');
  private readonly gridAnchor = viewChild<ElementRef<HTMLElement>>('gridAnchor');
  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');
  readonly stuck = signal(false);

  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  readonly username = computed(() => this.params().get('username') ?? '');

  readonly signedIn = this.auth.isAuthenticated;
  readonly isSelf = computed(() => this.auth.currentUser()?.username === this.username());
  readonly canCompare = computed(() => this.signedIn() && !this.isSelf());

  readonly commonOnly = linkedSignal(() => {
    this.username();
    return untracked(() => this.route.snapshot.queryParamMap.get('compare') === '1');
  });
  readonly comparing = computed(() => this.canCompare() && this.commonOnly());

  private readonly state = createFriendProfileState(
    {
      username: () => this.username(),
      onError: catchAndToastError(this.toastService, this.errorMessage),
      onLoaded: () => this.page.reloadItems(),
      signedIn: () => this.signedIn(),
    },
    { userProfileService: this.userProfileService, collectionService: this.collectionService },
  );

  private readonly page = createFriendProfilePage(
    {
      username: () => this.username(),
      scrollContainer: () => this.scrollContainer()?.nativeElement ?? null,
      resetScrollTop: () => this.gridScrollTop(),
      windowEnabled: () => !this.comparing(),
      onError: catchAndToastError(this.toastService, this.errorMessage),
    },
    { collectionService: this.collectionService, storage: this.localStorage },
  );

  readonly statusFilter = this.page.filters.statusFilter;
  readonly mediaTypeFilter = this.page.filters.mediaTypeFilter;
  readonly ratingFrom = this.page.filters.ratingFrom;
  readonly ratingTo = this.page.filters.ratingTo;
  readonly includeUnrated = this.page.filters.includeUnrated;
  readonly sortBy = this.page.filters.sortBy;
  readonly sortDirection = this.page.filters.sortDirection;
  readonly hasNote = this.page.filters.hasNote;
  readonly searchTerm = this.page.searchTerm;
  readonly filterHandlers = this.page.filters.handlers(() => this.page.reloadItems());

  readonly searchDraft = signal(this.searchTerm());
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly sheetOpen = signal(false);
  readonly skeletonSlots = Array.from({ length: 12 }, (_, i) => i);

  readonly scrollWindow = this.page.window;

  readonly stats = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) =>
        this.collectionService
          .statsForUser(params.get('username') ?? '')
          .pipe(catchError(() => of(null))),
      ),
    ),
    { initialValue: null },
  );
  readonly commonItems = computed(() =>
    this.page.allItems().filter((item) => this.ownItemFor(item) !== null),
  );
  readonly filterStats = computed(() =>
    this.comparing() ? shelfStats(this.commonItems()) : this.stats(),
  );

  readonly statusCounts = computed<Partial<Record<UserMediaStatus, number>> | null>(() => {
    const stats = this.filterStats();
    if (!stats) return null;
    const types = this.mediaTypeFilter();
    const byType = stats.countsByMediaTypeAndStatus;
    if (!types.length || !byType) return stats.countsByStatus ?? null;
    return Object.fromEntries(
      COLLECTION_STATUSES.map((status) => [
        status,
        types.reduce((sum, type) => sum + (byType[type]?.[status] ?? 0), 0),
      ]),
    );
  });
  readonly statusTotal = computed(() => {
    const counts = this.statusCounts();
    return counts ? Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0) : null;
  });
  readonly mediaTypeCounts = computed<Partial<Record<MediaType, number>> | null>(() => {
    const stats = this.filterStats();
    if (!stats) return null;
    const byType = stats.countsByMediaTypeAndStatus;
    const statuses = this.statusFilter();
    if (!byType || !statuses.length) return stats.countsByMediaType;
    return countsForStatuses(byType, statuses);
  });
  readonly mediaTypeTotal = computed(() => {
    const counts = this.mediaTypeCounts();
    return counts ? Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0) : null;
  });

  readonly fullItems = this.page.fullItems;
  readonly fullItemsLoading = this.page.fullItemsLoading;

  readonly loading = this.state.loading;
  readonly notAvailable = this.state.notAvailable;
  readonly profile = this.state.profile;

  readonly friendName = computed(() => {
    const profile = this.profile();
    return profile ? profile.displayName || profile.username : '';
  });

  readonly heroTitle = computed(() => {
    this.translate.lang();
    return this.translate.get('friends.shelf.title', { name: this.friendName() });
  });

  readonly heroStats = computed(() => {
    const stats = this.stats();
    if (!stats) return null;
    const average = stats.averageRating ?? null;
    return {
      total: stats.total,
      ongoing: stats.countsByStatus?.ongoing ?? 0,
      average: average === null ? null : formatRating(average),
      common: this.canCompare() ? this.commonItems().length : null,
    };
  });

  readonly statusTabs = computed(() => {
    this.translate.lang();
    const counts = this.statusCounts();
    return [
      { id: 'all', label: this.translate.get('library.all'), count: this.statusTotal() },
      ...(['ongoing', 'planned', 'done', 'dropped'] as const).map((status) => ({
        id: status,
        label: this.translate.get('collection.status.' + status),
        count: counts?.[status] ?? null,
      })),
    ];
  });
  readonly activeStatusTab = computed(() => {
    const statuses = this.statusFilter();
    if (!statuses.length) return 'all';
    return statuses.length === 1 ? statuses[0] : '';
  });

  readonly activeFilterCount = computed(
    () =>
      (this.statusFilter().length ? 1 : 0) +
      (this.mediaTypeFilter().length ? 1 : 0) +
      (this.ratingFrom() !== 'unrated' || this.ratingTo() !== 10 ? 1 : 0) +
      (this.hasNote() ? 1 : 0) +
      (this.comparing() ? 1 : 0),
  );

  readonly items = computed(() =>
    this.comparing()
      ? this.fullItems().filter((item) => this.ownItemFor(item) !== null)
      : this.scrollWindow.items(),
  );
  readonly visibleItems = computed(() =>
    this.hasNote() ? this.items().filter((item) => item.note != null) : this.items(),
  );
  readonly listLoading = computed(() =>
    this.comparing() ? this.fullItemsLoading() : this.scrollWindow.loading(),
  );
  readonly resultCount = computed(() =>
    this.comparing() ? this.visibleItems().length : this.scrollWindow.totalElements(),
  );
  readonly shelfEmpty = computed(() => this.stats()?.total === 0);

  readonly backdropUrl = createShelfBackdrop(this.items);
  private readonly wall = createPosterWall();
  readonly ambientWall = computed(() => {
    const backdrop = this.backdropUrl();
    return backdrop ? [backdrop] : this.wall.posters();
  });

  readonly resultCaption = computed(() => {
    this.translate.lang();
    if (this.activeFilterCount() === 0 && !this.searchTerm().trim()) return null;
    if (this.listLoading()) return null;
    return this.translate.get('collection.results', { count: this.resultCount() });
  });

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    const status = params.get('status');
    if (params.get('view') === 'backlog' || status === 'planned') {
      this.statusFilter.set(['planned']);
    } else if (status === 'ongoing' || status === 'done' || status === 'dropped') {
      this.statusFilter.set([status]);
    }
    this.state.load();
    effect(() => void this.ambient.follow(this.backdropUrl()));
    effect(() => {
      if (this.shelfEmpty()) this.wall.load();
    });
    const destroyRef = inject(DestroyRef);
    this.layout.scrollTop.set(0);
    destroyRef.onDestroy(() => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
      void this.ambient.follow(null);
      this.layout.scrollTop.set(0);
    });

    this.collectionService.changes.pipe(takeUntilDestroyed()).subscribe((event) => {
      switch (event.type) {
        case 'updated':
          return this.state.applyOwnUpdate(event.item);
        case 'bulkUpdated':
          return event.items.forEach(this.state.applyOwnUpdate);
        case 'created':
          return this.state.applyOwnAdd(event.item);
        case 'removed':
          return this.state.applyOwnRemoval([event.id]);
        case 'bulkRemoved':
          return this.state.applyOwnRemoval(event.ids);
        case 'cleared':
          return this.state.clearOwn();
      }
    });

    effect(() => {
      this.username();
      if (this.canCompare()) untracked(() => this.page.loadAllItems());
    });

    effect(() => {
      if (!this.comparing()) return;
      this.statusFilter();
      this.mediaTypeFilter();
      this.ratingFrom();
      this.ratingTo();
      this.includeUnrated();
      this.searchTerm();
      this.sortBy();
      this.sortDirection();
      untracked(() => this.page.loadFullItems());
    });
  }

  private gridScrollTop(): number {
    const anchor = this.gridAnchor()?.nativeElement;
    const nav = window.matchMedia?.('(min-width: 768px)').matches ? 68 : 0;
    return anchor ? Math.max(0, anchor.offsetTop - nav) : 0;
  }

  tile(on: boolean): string {
    return FILTER_TILE + ' ' + (on ? FILTER_TILE_ON : FILTER_TILE_OFF);
  }

  statusLine(item: CollectionItemResponse): string {
    const status = this.translate.get(statusLabelKey(item.status, item.media.mediaType));
    const type = this.translate.get('collection.media_type_one.' + item.media.mediaType);
    return `${status} · ${type}`;
  }

  onStatusTab(id: string): void {
    this.filterHandlers.onStatusFilterChange(id === 'all' ? [] : [id as UserMediaStatus]);
  }

  onSortBy(field: CollectionSortBy): void {
    this.filterHandlers.onSortByChange(field);
  }

  onDirection(direction: CollectionSortDirection): void {
    this.filterHandlers.onSortDirectionChange(direction);
  }

  onSearchInput(value: string): void {
    this.searchDraft.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(
      () => this.filterHandlers.onSearchChange(value),
      SEARCH_DEBOUNCE_MS,
    );
  }

  clearSearch(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchDraft.set('');
    this.filterHandlers.onSearchChange('');
  }

  clearFilters(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchDraft.set('');
    this.page.filters.clear();
    this.setCommonOnly(false);
    this.page.reloadItems();
  }

  setCommonOnly(value: boolean): void {
    if (value === this.commonOnly()) return;
    this.commonOnly.set(value);
    if (!value) this.page.reloadItems();
  }

  toggleCommonOnly(): void {
    this.setCommonOnly(!this.commonOnly());
  }

  ownItemFor(item: CollectionItemResponse): CollectionItemResponse | null {
    return this.state.ownItemFor(item);
  }

  mineLine(item: CollectionItemResponse): string | null {
    const own = this.ownItemFor(item);
    if (!this.comparing() || !own) return null;
    const status = this.translate.get(statusLabelKey(own.status, item.media.mediaType));
    const parts = [status, own.rating === null ? null : formatRating(own.rating) + '/5'];
    return this.translate.get('friends.shelf.mine', {
      value: parts.filter(Boolean).join(' · '),
    });
  }

  onScroll(): void {
    this.page.onScroll();
    const el = this.scrollContainer()?.nativeElement;
    this.layout.scrollTop.set(el?.scrollTop ?? 0);
    const sentinel = this.sentinel()?.nativeElement;
    if (!el || !sentinel) return;
    const top = sentinel.getBoundingClientRect().top - el.getBoundingClientRect().top;
    const nav =
      window.innerWidth >= 768
        ? parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--nav-bar-height'),
          ) || 76
        : 0;
    this.stuck.set(top < nav - 0.5);
  }
}
