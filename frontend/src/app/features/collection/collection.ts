import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { PageFooterComponent } from '@shared/ui/page-footer/page-footer';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SpinnerComponent } from '@shared/ui/spinner/spinner';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { EmptyStateComponent } from '@shared/ui/empty-state/empty-state';
import { ButtonComponent } from '@shared/ui/button/button';
import { ButtonLinkDirective } from '@shared/ui/button/button-link';
import { IconComponent } from '@shared/ui/icon/icon';
import { TabsComponent } from '@shared/ui/tabs/tabs';
import { DialogComponent } from '@shared/ui/dialog/dialog';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { TranslateService } from '@app/core/services/translate/translate';
import { CollectionService } from '@app/core/services/collection/collection';
import { LocalStorageService } from '@app/core/services/local-storage/local-storage';
import type {
  CollectionItemResponse,
  CollectionSortBy,
  CollectionSortDirection,
  MediaType,
  UserMediaStatus,
} from '@app/core/services/collection/collection.model';
import { isVisibleMediaType } from '@app/core/services/collection/collection.model';
import { AmbientService } from '@app/core/services/ambient/ambient';
import { LayoutService } from '@app/core/services/layout/layout';
import { ItemSheetService } from '@app/core/services/item-sheet/item-sheet';
import { createPosterWall } from '@shared/utils/poster-wall.util';
import { FilterPanelComponent } from '@shared/ui/filter-panel/filter-panel';
import { MenuButtonComponent } from '@shared/ui/menu-button/menu-button';
import { COLLECTION_STATUSES, countsForStatuses } from '@shared/utils/collection-status.util';
import { formatRating } from '@shared/utils/collection-rating.util';
import { MEDIA_TYPE_ICON } from '@shared/utils/media-type-icon.util';
import { createCollectionPage, SHELVED } from './data-access/collection-page';
import { MediaCardComponent } from '@shared/ui/media-card/media-card';
import { PageHeroComponent } from '@shared/ui/page-hero/page-hero';
import { LibraryFiltersComponent } from './ui/library-filters/library-filters';
import { LibrarySortComponent } from './ui/library-sort/library-sort';
import { createShelfBackdrop } from './state/collection-banner-state';
import type { PosterSize } from '@shared/ui/ui-recipes';
import { StartShelfComponent } from '@shared/ui/start-shelf/start-shelf';

const SIZE_KEY = 'collection.size';
const SEARCH_DEBOUNCE_MS = 250;

const BULK_BUTTON =
  'flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[13px] px-3.5 text-base font-semibold whitespace-nowrap transition-colors disabled:opacity-50 max-md:w-12 max-md:px-0';

const SHELF_TYPES: readonly MediaType[] = ['movie', 'tv_show', 'game', 'anime', 'manga', 'webtoon'];

@Component({
  selector: 'shelfy-collection-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TabsComponent,
    PageFooterComponent,
    SpinnerComponent,
    TranslatePipe,
    EmptyStateComponent,
    PageHeroComponent,
    LibraryFiltersComponent,
    StartShelfComponent,
    LibrarySortComponent,
    ButtonComponent,
    ButtonLinkDirective,
    RouterLink,
    IconComponent,
    MediaCardComponent,
    DialogComponent,
    FilterPanelComponent,
    MenuButtonComponent,
  ],
  templateUrl: './collection.html',
  host: {
    class: 'block h-full',
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class CollectionPageComponent {
  private readonly collectionService = inject(CollectionService);
  private readonly injector = inject(Injector);
  private readonly localStorage = inject(LocalStorageService);
  private readonly toastService = inject(ToastService);
  private readonly errorMessage = inject(ErrorMessageService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly layout = inject(LayoutService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ambient = inject(AmbientService);
  private readonly itemSheet = inject(ItemSheetService);

  readonly scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');
  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');
  readonly stuck = signal(false);

  private readonly toastLoadError = catchAndToastError(this.toastService, this.errorMessage);

  private readonly page = createCollectionPage(
    {
      scrollContainer: () => this.scrollContainer()?.nativeElement ?? null,
      onError: (error) => {
        if (this.items().length > 0) this.toastLoadError(error);
      },
    },
    {
      collectionService: this.collectionService,
      injector: this.injector,
      storage: this.localStorage,
    },
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

  readonly size = signal<PosterSize>(this.storedSize());
  readonly sheetOpen = signal(false);

  readonly exitingIds = signal<ReadonlySet<string>>(new Set());

  readonly items = this.page.window.items;
  readonly totalElements = this.page.window.totalElements;
  readonly loading = this.page.window.loading;
  readonly loadFailed = this.page.window.loadFailed;
  readonly loadingMore = this.page.window.loadingMore;
  readonly loadingPrevious = this.page.window.loadingPrevious;
  readonly hasMoreDown = this.page.window.hasMoreDown;
  readonly newestPage = this.page.window.newestPage;

  readonly stats = this.page.metadata.stats;

  readonly statusCounts = computed<Partial<Record<UserMediaStatus, number>> | null>(() => {
    const stats = this.stats();
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
    return counts ? SHELVED.reduce((sum, status) => sum + (counts[status] ?? 0), 0) : null;
  });
  readonly mediaTypeCounts = computed<Partial<Record<MediaType, number>> | null>(() => {
    const stats = this.stats();
    if (!stats) return null;
    const byType = stats.countsByMediaTypeAndStatus;
    const statuses = this.statusFilter();
    if (!byType) return stats.countsByMediaType;
    return countsForStatuses(byType, statuses.length ? statuses : SHELVED);
  });
  readonly mediaTypeTotal = computed(() => {
    const counts = this.mediaTypeCounts();
    return counts ? Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0) : null;
  });

  readonly typeSegments = computed(() => {
    const owned = this.stats()?.countsByMediaType;
    const counts = this.mediaTypeCounts();
    const selected = this.mediaTypeFilter();
    return SHELF_TYPES.filter(
      (type) => !owned || (owned[type] ?? 0) > 0 || selected.includes(type),
    ).map((type) => ({
      type,
      icon: MEDIA_TYPE_ICON[type],
      count: counts?.[type] ?? null,
      on: selected.includes(type),
    }));
  });

  readonly mediaMenu = computed(() => {
    this.translate.lang();
    const label = (type: MediaType) => this.translate.get('collection.media_type.' + type);
    const picked = this.typeSegments().filter((segment) => segment.on);
    return {
      items: [
        { id: 'all', label: this.translate.get('library.all'), meta: this.mediaTypeTotal() },
        ...this.typeSegments().map((segment) => ({
          id: segment.type,
          label: label(segment.type),
          icon: segment.icon,
          meta: segment.count,
        })),
      ],
      selected: picked.length ? picked.map((segment) => segment.type) : ['all'],
      icon: picked.length === 1 ? picked[0].icon : 'grid',
      text: picked.length
        ? picked.length <= 2
          ? picked.map((segment) => label(segment.type)).join(', ')
          : this.translate.get('library.media_count', { count: picked.length })
        : this.translate.get('library.all_media'),
    };
  });

  readonly heroStats = computed(() => {
    const stats = this.stats();
    if (!stats) return null;
    const average = stats.averageRating ?? null;
    return {
      total: stats.total,
      ongoing: stats.countsByStatus?.ongoing ?? 0,
      average: average === null ? null : formatRating(average),
    };
  });

  readonly statusTabs = computed(() => {
    this.translate.lang();
    const counts = this.statusCounts();
    const tab = (status: UserMediaStatus) => ({
      id: status,
      label: this.translate.get('collection.status.' + status),
      count: counts?.[status] ?? null,
    });
    return [
      tab('planned'),
      {
        id: 'all',
        label: this.translate.get('library.all'),
        count: this.statusTotal(),
        separated: true,
      },
      ...(['ongoing', 'done', 'dropped'] as const).map(tab),
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
      (this.ratingFrom() !== 'unrated' || this.ratingTo() !== 10 ? 1 : 0) +
      (this.hasNote() ? 1 : 0),
  );

  readonly visibleItems = computed(() =>
    this.hasNote() ? this.items().filter((item) => item.note != null) : this.items(),
  );

  readonly hasActiveFilters = computed(
    () => this.activeFilterCount() > 0 || this.searchTerm().trim() !== '',
  );

  readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly selecting = computed(() => this.selectedCount() > 0);
  readonly allVisibleSelected = computed(() => {
    const visible = this.visibleItems();
    const selected = this.selectedIds();
    return visible.length > 0 && visible.every((item) => selected.has(item.id));
  });
  readonly bulkDeleteConfirmOpen = signal(false);
  readonly bulkDeleting = signal(false);

  private readonly navHeight = () =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-bar-height')) ||
    76;
  protected readonly bulkButton = BULK_BUTTON + ' bg-white/7 text-text hover:bg-white/12';
  protected readonly bulkDanger = BULK_BUTTON + ' bg-danger-soft text-danger-fg hover:bg-danger/20';
  readonly skeletonSlots = Array.from({ length: 12 }, (_, i) => i);

  readonly headerBackdrop = createShelfBackdrop(this.items);
  readonly shelfEmpty = computed(() => this.stats()?.total === 0);
  private readonly wall = createPosterWall();
  readonly ambientWall = computed(() => {
    const backdrop = this.headerBackdrop();
    return backdrop ? [backdrop] : this.wall.posters();
  });

  readonly resultCaption = computed(() => {
    this.translate.lang();
    if (!this.hasActiveFilters() || this.hasNote() || this.loading()) return null;
    return this.translate.get('collection.results', { count: this.totalElements() });
  });

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    const status = params.get('status');
    if (params.get('view') === 'backlog' || status === 'planned') {
      this.statusFilter.set(['planned']);
    } else if (status === 'ongoing' || status === 'done' || status === 'dropped') {
      this.statusFilter.set([status]);
    }
    const type = params.get('type');
    if (type && isVisibleMediaType(type) && SHELF_TYPES.includes(type as MediaType)) {
      this.mediaTypeFilter.set([type as MediaType]);
    }
    this.bindScroll();
    this.page.reloadItems();
    this.page.metadata.load();
    this.bindItemSheet();
    this.bindChanges();
    effect(() => {
      if (this.shelfEmpty()) this.wall.load();
    });
  }

  private storedSize(): PosterSize {
    const stored = this.localStorage.getItem(SIZE_KEY);
    return stored === 's' || stored === 'l' ? stored : 'm';
  }

  openSheet(): void {
    this.sheetOpen.set(true);
  }

  onStatusesChange(statuses: UserMediaStatus[]): void {
    this.filterHandlers.onStatusFilterChange(statuses);
  }

  toggleMediaType(type: MediaType): void {
    const current = this.mediaTypeFilter();
    const shown = this.typeSegments().map((segment) => segment.type);
    const next = current.includes(type)
      ? current.filter((value) => value !== type)
      : SHELF_TYPES.filter((value) => value === type || current.includes(value));
    this.filterHandlers.onMediaTypeFilterChange(
      shown.every((value) => next.includes(value)) ? [] : next,
    );
  }

  onMediaPick(id: string): void {
    if (id === 'all') this.filterHandlers.onMediaTypeFilterChange([]);
    else this.toggleMediaType(id as MediaType);
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

  searchShelfy(): void {
    void this.router.navigate(['/explore'], { queryParams: { q: this.searchTerm().trim() } });
  }

  clearFilters(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchDraft.set('');
    this.page.filters.clear();
    this.page.reloadItems();
  }

  toggleItemSelection(id: string): void {
    this.selectedIds.update((ids) => {
      const next = new Set(ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggleSelectAll(): void {
    this.selectedIds.set(
      this.allVisibleSelected() ? new Set() : new Set(this.visibleItems().map((item) => item.id)),
    );
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  openBulkEdit(): void {
    const selected = this.selectedIds();
    if (!selected.size) return;
    this.itemSheet.openBulk(
      this.items().filter((item) => selected.has(item.id)),
      COLLECTION_STATUSES,
    );
  }

  openBulkDeleteConfirm(): void {
    if (this.selectedCount() > 0) this.bulkDeleteConfirmOpen.set(true);
  }

  closeBulkDeleteConfirm(): void {
    if (!this.bulkDeleting()) this.bulkDeleteConfirmOpen.set(false);
  }

  confirmBulkDelete(): void {
    const ids = [...this.selectedIds()];
    if (!ids.length) return;
    this.bulkDeleting.set(true);
    this.collectionService.bulkRemove(ids).subscribe({
      next: () => {
        this.bulkDeleting.set(false);
        this.bulkDeleteConfirmOpen.set(false);
        this.clearSelection();
        this.toastService.success(
          this.translate.get('collection.bulk.deleted', { count: ids.length }),
        );
      },
      error: (error: unknown) => {
        this.bulkDeleting.set(false);
        catchAndToastError(this.toastService, this.errorMessage)(error);
      },
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.sheetOpen()) return;
    if (event.key === 'Escape' && this.selecting() && !this.itemSheet.item()) this.clearSelection();
  }

  retryLoad(): void {
    this.page.reloadItems();
  }

  onScroll(): void {
    this.page.onScroll();
    this.layout.scrollTop.set(this.scrollContainer()?.nativeElement.scrollTop ?? 0);
    const container = this.scrollContainer()?.nativeElement;
    const sentinel = this.sentinel()?.nativeElement;
    if (container && sentinel) {
      const top = sentinel.getBoundingClientRect().top - container.getBoundingClientRect().top;
      this.stuck.set(top < (window.innerWidth >= 768 ? this.navHeight() : 0) - 0.5);
    }
  }

  private bindScroll(): void {
    afterNextRender(() => {
      const el = this.scrollContainer()?.nativeElement;
      if (!el) return;
      const listener = () => this.onScroll();
      el.addEventListener('scroll', listener, { passive: true });
      this.destroyRef.onDestroy(() => el.removeEventListener('scroll', listener));
    });
    effect(() => void this.ambient.follow(this.headerBackdrop()));
    this.layout.scrollTop.set(0);
    this.destroyRef.onDestroy(() => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
      void this.ambient.follow(null);
      this.layout.scrollTop.set(0);
    });
  }

  private bindItemSheet(): void {
    this.itemSheet.updated
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((item) => this.onItemUpdated(item));
    this.itemSheet.bulkApplied.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((items) => {
      this.clearSelection();
      this.toastService.success(
        this.translate.get('collection.bulk.updated', { count: items.length }),
      );
    });
    this.destroyRef.onDestroy(() => this.itemSheet.close());
  }

  private bindChanges(): void {
    this.page.watchChanges({
      onRemoved: (id) => this.onItemDeleted(id),
      onCreated: (item) => this.onItemCreated(item),
      onCleared: () => this.page.reloadItems(),
      onUpdated: (item) => this.onItemUpdated(item),
      onBulkUpdated: (items) => items.forEach((item) => this.onItemUpdated(item)),
      onBulkRemoved: (ids) => ids.forEach((id) => this.onItemDeleted(id)),
      onChangeApplied: () => this.page.metadata.reloadStats(),
    });
  }

  private onItemCreated(item: CollectionItemResponse): void {
    if (this.items().some((existing) => existing.id === item.id)) return;
    if (!this.page.matchesFilters(item)) return;
    this.items.set([item, ...this.items()]);
    this.totalElements.set(this.totalElements() + 1);
  }

  onItemUpdated(updated: CollectionItemResponse): void {
    const present = this.items().some((item) => item.id === updated.id);
    if (this.page.matchesFilters(updated)) {
      if (!present) {
        this.onItemCreated(updated);
        return;
      }
      this.items.set(this.items().map((item) => (item.id === updated.id ? updated : item)));
      if (this.exitingIds().has(updated.id)) {
        this.exitingIds.update((ids) => {
          const next = new Set(ids);
          next.delete(updated.id);
          return next;
        });
        this.totalElements.set(this.totalElements() + 1);
      }
      return;
    }
    if (!present || this.exitingIds().has(updated.id)) return;
    this.totalElements.set(this.totalElements() - 1);
    this.exitingIds.update((ids) => new Set(ids).add(updated.id));
  }

  onItemDeleted(id: string): void {
    if (this.itemSheet.item()?.id === id) this.itemSheet.close();
    this.selectedIds.update((ids) => {
      if (!ids.has(id)) return ids;
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
    if (!this.items().some((item) => item.id === id) || this.exitingIds().has(id)) return;
    this.totalElements.set(this.totalElements() - 1);
    this.exitingIds.update((ids) => new Set(ids).add(id));
  }

  finalizeRemoval(id: string): void {
    if (!this.exitingIds().has(id)) return;
    this.exitingIds.update((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
    this.items.set(this.items().filter((item) => item.id !== id));
  }
}
