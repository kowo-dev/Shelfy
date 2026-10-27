import {
  FILTER_GROUP_TITLE,
  FILTER_TILE,
  FILTER_TILE_OFF,
  FILTER_TILE_ON,
} from '@shared/ui/ui-recipes';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { AuthService } from '@app/core/services/auth/auth';
import { CollectionService } from '@app/core/services/collection/collection';
import { LocalStorageService } from '@app/core/services/local-storage/local-storage';
import {
  EXPLORE_MEDIA_TYPES,
  ExploreCatalogService,
} from '@app/core/services/search/explore-catalog';
import {
  EMPTY_EXPLORE_QUERY,
  EXPLORE_SORTS,
  type ExploreQuery,
} from '@app/core/services/search/explore-query';
import { ExploreHistoryService } from '@app/core/services/search/explore-history';
import { SearchService } from '@app/core/services/search/search';
import type { SearchResult } from '@app/core/services/search/search.model';
import { TranslateService } from '@app/core/services/translate/translate';
import { createExploreQueryEditor } from '@app/features/explore/state/explore-query-editor';
import { createExploreResults } from '@app/features/explore/state/explore-results';
import { observeLoadMore } from '@shared/utils/scroll-observers';
import { ExploreFiltersComponent } from '@app/features/explore/ui/explore-filters/explore-filters';
import { ExploreOmniboxComponent } from '@app/features/explore/ui/explore-omnibox/explore-omnibox';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { createSearchCollectionSync } from '@shared/utils/search-collection-sync';
import { buttonClasses, ButtonComponent } from '@shared/ui/button/button';
import { DialogComponent } from '@shared/ui/dialog/dialog';
import { IconComponent } from '@shared/ui/icon/icon';
import type { MenuButtonItem } from '@shared/ui/menu-button/menu-button';
import { SegmentedComponent } from '@shared/ui/segmented/segmented';
import { TabsComponent, type TabItem } from '@shared/ui/tabs/tabs';
import { searchResultKey, searchResultPoster } from '@shared/utils/search-result-media.util';
import { PickTileComponent } from './pick-tile/pick-tile';

export interface MediaKeyLike {
  provider: string;
  mediaType: string;
  externalId: string;
}

const TYPE_STORAGE_KEY = 'shelfy.media-picker.type';

const TRAY_COVERS = 4;

@Component({
  selector: 'shelfy-media-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ExploreFiltersComponent,
    ExploreOmniboxComponent,
    IconComponent,
    ButtonComponent,
    SegmentedComponent,
    PickTileComponent,
    TabsComponent,
    TranslatePipe,
    DialogComponent,
  ],
  templateUrl: './media-picker.html',
})
export class MediaPickerComponent {
  private readonly collectionService = inject(CollectionService);
  private readonly authService = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly storage = inject(LocalStorageService);
  private readonly injector = inject(Injector);
  readonly catalog = inject(ExploreCatalogService);
  readonly history = inject(ExploreHistoryService);

  readonly open = input(false);
  readonly heading = input<string | null>(null);
  readonly headingKey = computed(() => this.heading() ?? 'shared.media_picker.title');
  readonly alreadySelected = input<readonly MediaKeyLike[]>([]);

  readonly picked = output<SearchResult>();
  readonly unpicked = output<SearchResult>();
  readonly closed = output<void>();

  private readonly omnibox = viewChild(ExploreOmniboxComponent);
  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly dialog = viewChild(DialogComponent);

  readonly pending = signal<readonly SearchResult[]>([]);
  readonly pendingKeys = computed(() => new Set(this.pending().map((r) => this.resultKey(r))));
  readonly trayCovers = computed(() =>
    this.pending()
      .slice(-TRAY_COVERS)
      .map((result) => ({ key: this.resultKey(result), src: searchResultPoster(result, 'card') })),
  );
  readonly filtersOpen = signal(false);
  readonly closeButton = buttonClasses({
    variant: 'secondary',
    iconOnly: true,
    extraClass: 'shrink-0',
  });
  readonly groupTitle = FILTER_GROUP_TITLE;
  readonly secondaryButton = buttonClasses({ variant: 'secondary', size: 'sm' });
  readonly primaryButton = buttonClasses({ variant: 'primary', size: 'sm' });
  readonly tile = (on: boolean) => `${FILTER_TILE} ${on ? FILTER_TILE_ON : FILTER_TILE_OFF}`;
  readonly skeletons = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  readonly gridClass = 'v-lgrid';

  readonly exploreQuery = signal<ExploreQuery>(EMPTY_EXPLORE_QUERY);
  readonly results = createExploreResults({
    searchService: inject(SearchService),
    region: () => this.catalog.region(),
  });
  readonly collectionSync = createSearchCollectionSync({
    collectionService: this.collectionService,
    allResults: this.results.results,
    injector: this.injector,
  });
  private readonly editor = createExploreQueryEditor(
    this.catalog,
    () => this.exploreQuery(),
    (change) => this.exploreQuery.update((query) => ({ ...query, ...change })),
  );
  readonly setCriterionState = this.editor.setCriterionState;
  readonly addCriterion = this.editor.addCriterion;
  readonly removeChip = this.editor.removeChip;
  readonly setText = this.editor.setText;
  readonly setYears = this.editor.setYears;
  readonly setSort = this.editor.setSort;
  readonly clearFilters = this.editor.clearFilters;
  readonly setType = this.editor.setType;

  readonly signedIn = computed(() => !!this.authService.currentUser());
  readonly hideOwned = computed(() => this.signedIn() && this.history.hideOwned());
  readonly visibleResults = computed(() => {
    const results = this.results.results();
    return this.hideOwned() ? results.filter((result) => !this.owned(result)) : results;
  });

  private readonly allowAdultContent = computed(
    () => this.authService.currentUser()?.isAdultContentAllowed ?? false,
  );

  readonly typeTabs = computed<TabItem[]>(() => [
    { id: 'all', label: this.translate.get('explore.all_types') },
    ...EXPLORE_MEDIA_TYPES.map((type) => ({
      id: type,
      label: this.catalog.typeLabel(type),
    })),
  ]);
  readonly sortItems = computed<MenuButtonItem[]>(() =>
    EXPLORE_SORTS.map((sort) => ({ id: sort, label: this.translate.get(`explore.sort.${sort}`) })),
  );
  readonly filterCount = computed(() => {
    const query = this.exploreQuery();
    return (
      query.with.length + query.without.length + (query.from !== null || query.to !== null ? 1 : 0)
    );
  });
  readonly alreadySelectedKeys = computed(
    () => new Set(this.alreadySelected().map((item) => this.key(item))),
  );

  constructor() {
    this.bindOpen();
    this.bindQuery();
    observeLoadMore(this.sentinel, () => this.results.loadMore(), this.scroller);
  }

  private bindOpen(): void {
    effect(() => {
      if (!this.open()) {
        untracked(() => this.reset());
        return;
      }
      untracked(() => {
        this.catalog.load();
        this.restoreType();
        afterNextRender(() => this.omnibox()?.focus(), { injector: this.injector });
      });
    });
  }

  private bindQuery(): void {
    effect(() => {
      const query = this.exploreQuery();
      if (!this.open()) return;
      untracked(() => {
        this.results.load(query);
        const scroller = this.scroller()?.nativeElement;
        if (scroller) scroller.scrollTop = 0;
      });
    });

    let adultContent = this.allowAdultContent();
    effect(() => {
      const allowed = this.allowAdultContent();
      if (allowed === adultContent) return;
      adultContent = allowed;
      untracked(() => {
        if (this.open()) this.results.load(this.exploreQuery());
      });
    });
  }

  selectTypeTab(id: string): void {
    this.editor.selectTypeTab(id);
    this.storage.setItem(TYPE_STORAGE_KEY, id);
  }

  private restoreType(): void {
    const stored = this.storage.getItem(TYPE_STORAGE_KEY);
    const type = EXPLORE_MEDIA_TYPES.find((mediaType) => mediaType === stored);
    if (type) this.editor.setType(type);
  }

  resultKey(result: SearchResult): string {
    return searchResultKey(result);
  }

  poster(result: SearchResult): string | null {
    return searchResultPoster(result, 'card');
  }

  meta(result: SearchResult): string {
    const type = this.translate.get('collection.media_type_one.' + result.mediaType);
    return result.releaseYear ? `${type} · ${result.releaseYear}` : type;
  }

  owned(result: SearchResult): boolean {
    return (
      result.isInCollection || !!this.collectionSync.collectionItemByKey()[this.resultKey(result)]
    );
  }

  isSelected(item: SearchResult): boolean {
    return this.alreadySelectedKeys().has(this.key(item));
  }

  isChecked(item: SearchResult): boolean {
    return this.isSelected(item) || this.pendingKeys().has(this.resultKey(item));
  }

  pick(item: SearchResult): void {
    if (this.isSelected(item)) {
      this.unpicked.emit(item);
      return;
    }
    const key = this.resultKey(item);
    this.pending.update((list) =>
      list.some((r) => this.resultKey(r) === key)
        ? list.filter((r) => this.resultKey(r) !== key)
        : [...list, item],
    );
  }

  clearPending(): void {
    this.pending.set([]);
  }

  confirm(): void {
    const list = this.pending();
    this.pending.set([]);
    for (const item of list) this.picked.emit(item);
    this.requestClose();
  }

  requestClose(): void {
    this.dialog()?.requestClose();
  }

  onClosed(): void {
    this.reset();
    this.closed.emit();
  }

  private reset(): void {
    this.results.clear();
    this.exploreQuery.set(EMPTY_EXPLORE_QUERY);
    this.pending.set([]);
    this.filtersOpen.set(false);
  }

  private key(item: MediaKeyLike): string {
    return `${item.provider}:${item.mediaType}:${item.externalId}`;
  }
}
