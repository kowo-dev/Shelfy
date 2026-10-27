import { SegmentedComponent } from '@shared/ui/segmented/segmented';
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
  untracked,
  viewChild,
} from '@angular/core';
import { PageFooterComponent } from '@shared/ui/page-footer/page-footer';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@app/core/services/auth/auth';
import { CollectionService } from '@app/core/services/collection/collection';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import {
  EXPLORE_MEDIA_TYPES,
  ExploreCatalogService,
} from '@app/core/services/search/explore-catalog';
import { ExploreHistoryService } from '@app/core/services/search/explore-history';
import { SearchFocusService } from '@app/core/services/search-focus/search-focus';
import {
  exploreQueryKey,
  EXPLORE_SORTS,
  fromRouteParams,
  isBlankQuery,
  toRouteParams,
  type ExploreQuery,
} from '@app/core/services/search/explore-query';
import { SearchService } from '@app/core/services/search/search';
import type { SearchResult } from '@app/core/services/search/search.model';
import { TranslateService } from '@app/core/services/translate/translate';
import { buildPreviewItem } from '@app/features/discover/data-access/discover-preview.util';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { createSearchCollectionSync } from '@shared/utils/search-collection-sync';
import { ButtonComponent } from '@shared/ui/button/button';
import {
  FILTER_GROUP_TITLE,
  FILTER_TILE,
  FILTER_TILE_OFF,
  FILTER_TILE_ON,
} from '@shared/ui/ui-recipes';
import { PageHeroComponent } from '@shared/ui/page-hero/page-hero';
import { MediaCardComponent } from '@shared/ui/media-card/media-card';
import { FilterPanelComponent } from '@shared/ui/filter-panel/filter-panel';
import { IconComponent } from '@shared/ui/icon/icon';
import { TabsComponent } from '@shared/ui/tabs/tabs';
import type { MenuButtonItem } from '@shared/ui/menu-button/menu-button';
import { searchResultKey, searchResultPoster } from '@shared/utils/search-result-media.util';
import { observeLoadMore } from '@shared/utils/scroll-observers';
import { createExploreResults } from './state/explore-results';
import { createExploreCommunity } from './state/explore-community';
import { ShelfSectionComponent } from '@shared/ui/shelf-section/shelf-section';
import { CreationTileComponent } from '@shared/ui/creation-card/creation-tile';
import { ReviewCardComponent } from '@shared/ui/creation-card/review-card';
import { PersonCardComponent } from '@app/features/profile-connections/person-card';
import { createExploreQueryEditor } from './state/explore-query-editor';
import { ExploreFiltersComponent } from './ui/explore-filters/explore-filters';
import { ExploreOmniboxComponent } from './ui/explore-omnibox/explore-omnibox';

const OVERVIEW_TITLES = 12;

const PROVIDER_LABEL: Record<string, string> = {
  tmdb: 'TMDB',
  igdb: 'IGDB',
  anilist: 'AniList',
};

@Component({
  selector: 'shelfy-explore-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SegmentedComponent,
    TabsComponent,
    PageFooterComponent,
    TranslatePipe,
    ButtonComponent,
    IconComponent,
    MediaCardComponent,
    FilterPanelComponent,
    PageHeroComponent,
    ExploreOmniboxComponent,
    ExploreFiltersComponent,
    ShelfSectionComponent,
    CreationTileComponent,
    ReviewCardComponent,
    PersonCardComponent,
  ],
  templateUrl: './explore.html',
})
export class ExplorePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly searchService = inject(SearchService);
  private readonly collectionService = inject(CollectionService);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);
  readonly catalog = inject(ExploreCatalogService);
  readonly history = inject(ExploreHistoryService);

  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');
  private readonly omnibox = viewChild(ExploreOmniboxComponent);

  readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  readonly exploreQuery = computed(() => fromRouteParams(this.query()), {
    equal: (a, b) => exploreQueryKey(a) === exploreQueryKey(b),
  });
  readonly results = createExploreResults({
    searchService: this.searchService,
    region: () => this.catalog.region(),
  });
  readonly collectionSync = createSearchCollectionSync({
    collectionService: this.collectionService,
    allResults: this.results.results,
    injector: inject(Injector),
  });

  readonly signedIn = computed(() => !!this.auth.currentUser());
  private readonly allowAdultContent = computed(
    () => this.auth.currentUser()?.isAdultContentAllowed ?? false,
  );
  readonly hideOwned = this.history.hideOwned;
  protected readonly groupTitle = FILTER_GROUP_TITLE;
  readonly filtersOpen = signal(false);
  readonly stuck = signal(false);
  private readonly sentinelTop = viewChild<ElementRef<HTMLElement>>('sentinelTop');

  tile(on: boolean): string {
    return FILTER_TILE + ' ' + (on ? FILTER_TILE_ON : FILTER_TILE_OFF);
  }

  cardMeta(result: SearchResult): string {
    const type = this.translate.get('collection.media_type_one.' + result.mediaType);
    return result.releaseYear ? `${type} · ${result.releaseYear}` : type;
  }

  readonly visibleResults = computed(() => {
    const results = this.results.results();
    if (!this.hideOwned()) return results;
    const owned = this.collectionSync.collectionItemByKey();
    return results.filter((result) => !result.isInCollection && !owned[searchResultKey(result)]);
  });
  readonly overview = computed(() => {
    const query = this.exploreQuery();
    return !!query.text.trim() && query.type === null && !this.activeFilterCount();
  });
  readonly community = createExploreCommunity(
    computed(() => (this.overview() ? this.exploreQuery().text : '')),
  );
  readonly titlesExpanded = signal(false);
  readonly collapsed = computed(() => this.overview() && !this.titlesExpanded());
  readonly shownResults = computed(() =>
    this.collapsed() ? this.visibleResults().slice(0, OVERVIEW_TITLES) : this.visibleResults(),
  );
  readonly moreTitles = computed(
    () => this.visibleResults().length > OVERVIEW_TITLES || this.results.hasMore(),
  );
  readonly sortItems = computed<MenuButtonItem[]>(() =>
    EXPLORE_SORTS.map((sort) => ({ id: sort, label: this.translate.get(`explore.sort.${sort}`) })),
  );
  readonly sortLabel = computed(() =>
    this.translate.get(`explore.sort.${this.exploreQuery().sort}`),
  );
  readonly typeTabs = computed(() => [
    { id: 'all', label: this.translate.get('explore.all_types') },
    ...EXPLORE_MEDIA_TYPES.map((type) => ({ id: type, label: this.catalog.typeLabel(type) })),
  ]);
  readonly activeFilterCount = computed(() => {
    const query = this.exploreQuery();
    return (
      query.with.length + query.without.length + (query.from !== null || query.to !== null ? 1 : 0)
    );
  });
  readonly skippedLabel = computed(() =>
    this.results
      .skippedTypes()
      .filter((type) => EXPLORE_MEDIA_TYPES.includes(type))
      .map((type) => this.catalog.typeLabel(type))
      .join(', '),
  );

  constructor() {
    this.catalog.load();
    this.bindQuery();
    effect(() => {
      this.exploreQuery();
      untracked(() => this.titlesExpanded.set(false));
    });

    const searchFocus = inject(SearchFocusService);
    const injector = inject(Injector);
    effect(() => {
      if (!searchFocus.pending()) return;
      untracked(() => searchFocus.pending.set(false));
      afterNextRender(() => this.focusSearch(), { injector });
    });

    observeLoadMore(this.sentinel, () => this.results.loadMore());
    this.bindStuck();

    inject(DestroyRef).onDestroy(() => this.results.cancel());
  }

  private bindStuck(): void {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const sentinel = this.sentinelTop()?.nativeElement;
      if (!sentinel || typeof IntersectionObserver === 'undefined') return;
      const nav = window.innerWidth >= 768 ? this.navHeight() : 0;
      const observer = new IntersectionObserver(
        ([entry]) => this.stuck.set(!entry.isIntersecting && entry.boundingClientRect.top < nav),
        { root: document.querySelector('.app-main'), rootMargin: `-${nav}px 0px 0px 0px` },
      );
      observer.observe(sentinel);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private navHeight(): number {
    return (
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-bar-height')) ||
      76
    );
  }

  private bindQuery(): void {
    effect(() => {
      const query = this.exploreQuery();
      untracked(() => {
        this.results.load(query);
      });
    });

    effect(() => {
      if (this.results.loaded() && !this.results.failed()) {
        untracked(() => this.history.remember(this.exploreQuery()));
      }
    });

    let adultContent = this.allowAdultContent();
    effect(() => {
      const allowed = this.allowAdultContent();
      if (allowed === adultContent) return;
      adultContent = allowed;
      untracked(() => this.results.load(this.exploreQuery()));
    });
  }

  update(change: Partial<ExploreQuery>): void {
    const next = { ...this.exploreQuery(), ...change };
    this.router.navigate(['/explore'], {
      queryParams: toRouteParams(next),
      replaceUrl: true,
    });
  }

  private readonly editor = createExploreQueryEditor(
    this.catalog,
    () => this.exploreQuery(),
    (change) => this.update(change),
  );
  readonly selectTypeTab = this.editor.selectTypeTab;
  readonly setType = this.editor.setType;
  readonly addCriterion = this.editor.addCriterion;
  readonly removeChip = this.editor.removeChip;
  readonly setCriterionState = this.editor.setCriterionState;
  readonly setText = this.editor.setText;
  readonly setYears = this.editor.setYears;
  readonly setSort = this.editor.setSort;
  readonly clearFilters = this.editor.clearFilters;

  resetAll(): void {
    this.router.navigate(['/explore'], { queryParams: {}, replaceUrl: true });
  }

  removeLastCriterion(): void {
    const query = this.exploreQuery();
    if (query.without.length) this.update({ without: query.without.slice(0, -1) });
    else if (query.with.length) this.update({ with: query.with.slice(0, -1) });
    else if (query.from !== null || query.to !== null) this.update({ from: null, to: null });
    else if (query.text) this.update({ text: '' });
  }

  lastCriterionLabel(): string {
    const query = this.exploreQuery();
    const last = query.without.at(-1) ?? query.with.at(-1);
    return last ? this.catalog.label(last) : '';
  }

  isBlank(): boolean {
    return isBlankQuery(this.exploreQuery());
  }

  focusSearch(): void {
    document.querySelector('.app-main')?.scrollTo({ top: 0 });
    this.omnibox()?.focus();
  }

  resultKey(result: SearchResult): string {
    return searchResultKey(result);
  }

  private readonly previewCache = new Map<string, CollectionItemResponse>();

  private previewItem(result: SearchResult): CollectionItemResponse {
    const key = searchResultKey(result);
    const cached = this.previewCache.get(key);
    if (cached) return cached;
    const item = this.buildPreview(result);
    this.previewCache.set(key, item);
    return item;
  }

  private buildPreview(result: SearchResult): CollectionItemResponse {
    return buildPreviewItem(
      result.mediaType,
      result.externalId,
      result.title,
      searchResultPoster(result, 'card'),
      result.voteAverage,
      result.releaseYear === null ? null : `${result.releaseYear}-01-01`,
      { overview: result.overview },
    );
  }

  ownedItem(result: SearchResult): CollectionItemResponse | undefined {
    return this.collectionSync.collectionItemByKey()[searchResultKey(result)];
  }

  cardItem(result: SearchResult): CollectionItemResponse {
    return this.ownedItem(result) ?? this.previewItem(result);
  }

  providerLabel(provider: string): string {
    return PROVIDER_LABEL[provider] ?? provider.toUpperCase();
  }
}
