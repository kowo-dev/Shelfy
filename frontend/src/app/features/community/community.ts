import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { PageFooterComponent } from '@shared/ui/page-footer/page-footer';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FederationService } from '@app/core/services/federation/federation';
import { AuthService } from '@app/core/services/auth/auth';
import { AuthPromptService } from '@app/core/services/auth/auth-prompt';
import type { CommunityScope, CommunitySort } from '@app/core/services/community/community.model';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { LayoutService } from '@app/core/services/layout/layout';
import type { SearchResult } from '@app/core/services/search/search.model';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { ButtonComponent, buttonClasses } from '@shared/ui/button/button';
import { FilterPanelComponent } from '@shared/ui/filter-panel/filter-panel';
import { ShelfSectionComponent } from '@shared/ui/shelf-section/shelf-section';
import { CreationTileComponent } from '@shared/ui/creation-card/creation-tile';
import { ReviewCardComponent } from '@shared/ui/creation-card/review-card';
import { IconComponent } from '@shared/ui/icon/icon';
import { TabsComponent, type TabItem } from '@shared/ui/tabs/tabs';
import { MediaPickerComponent } from '@shared/ui/media-picker/media-picker';
import type { MenuButtonItem } from '@shared/ui/menu-button/menu-button';
import { PageHeroComponent } from '@shared/ui/page-hero/page-hero';
import { SpinnerComponent } from '@shared/ui/spinner/spinner';
import {
  FILTER_GROUP_TITLE,
  FILTER_TILE,
  FILTER_TILE_OFF,
  FILTER_TILE_ON,
} from '@shared/ui/ui-recipes';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { mediaQuerySignal, WIDE_LAYOUT_QUERY } from '@shared/utils/media-query.util';
import { reviewStudioLink } from '@shared/utils/review-studio-link.util';
import {
  COMMUNITY_SCOPES,
  COMMUNITY_VIEWS,
  parseCommunityUrl,
  scopeParam,
  tabParams,
} from './data-access/community-url';
import { createBannerState } from './state/banner-state';
import { createBrowseState } from './state/browse-state';
import type { CommunityContext } from './state/community-context';
import { createLandingState } from './state/landing-state';
import { CreationSkeletonComponent } from './ui/creation-skeleton';

const SEARCH_DEBOUNCE_MS = 300;
const BROWSE_PARAMS = ['f', 'scope', 'sort', 'q'] as const;
@Component({
  selector: 'shelfy-community-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TabsComponent,
    PageFooterComponent,
    NgTemplateOutlet,
    TranslatePipe,
    ButtonComponent,
    CreationSkeletonComponent,
    CreationTileComponent,
    IconComponent,
    MediaPickerComponent,
    PageHeroComponent,
    ReviewCardComponent,
    SpinnerComponent,
    ShelfSectionComponent,
    FilterPanelComponent,
  ],
  templateUrl: './community.html',
  host: { '(document:keydown)': 'onDocumentKey($event)' },
})
export class CommunityPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly authPrompt = inject(AuthPromptService);
  private readonly layout = inject(LayoutService);
  private readonly toast = inject(ToastService);
  private readonly errorMessage = inject(ErrorMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly onError = catchAndToastError(this.toast, this.errorMessage);

  readonly scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');
  private readonly searchInputs = viewChildren<ElementRef<HTMLInputElement>>('searchInput');

  readonly signedIn = this.auth.isAuthenticated;
  readonly wide = mediaQuerySignal(WIDE_LAYOUT_QUERY);
  readonly primaryButton = buttonClasses({ variant: 'primary', extraClass: 'gap-2.5' });
  readonly secondaryButton = buttonClasses({ variant: 'secondary', extraClass: 'gap-2.5' });
  protected readonly groupTitle = FILTER_GROUP_TITLE;
  readonly filtersOpen = signal(false);
  readonly createOpen = signal(false);
  readonly stuck = signal(false);
  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private readonly url = computed(() => parseCommunityUrl(this.params(), this.signedIn()));
  readonly landing = computed(() => !BROWSE_PARAMS.some((name) => this.params().has(name)));

  readonly view = computed(() => this.url().view);
  readonly scope = computed(() => this.url().scope);
  readonly sort = computed(() => this.url().sort);
  readonly query = computed(() => this.url().query);
  readonly creating = computed(() => this.url().create);
  readonly showVisibility = computed(() => this.scope() === 'MINE');
  readonly activeTab = computed(() => (this.landing() ? 'overview' : this.view()));

  private readonly context: CommunityContext = {
    signedIn: this.signedIn,
    view: this.view,
    scope: this.scope,
    sort: this.sort,
    query: this.query,
  };

  readonly browse = createBrowseState(this.context, {
    scrollContainer: () => this.scrollContainer()?.nativeElement ?? null,
    onError: this.onError,
    enabled: () => !this.landing(),
  });
  readonly landingState = createLandingState(this.signedIn);
  readonly banner = createBannerState(this.signedIn);

  readonly searchDraft = signal(this.route.snapshot.queryParamMap.get('q') ?? '');
  readonly pickerOpen = signal(false);

  readonly tabs = computed<TabItem[]>(() => {
    this.translate.lang();
    return ['overview', ...COMMUNITY_VIEWS].map((id) => ({
      id,
      label: this.translate.get(`community.tabs.${id}`),
    }));
  });

  readonly createItems = computed<MenuButtonItem[]>(() => {
    this.translate.lang();
    return [
      { id: 'list', icon: 'lists', label: this.translate.get('community.create_list') },
      { id: 'versus', icon: 'compare', label: this.translate.get('community.create_versus') },
      { id: 'review', icon: 'reviews', label: this.translate.get('community.create_review') },
    ];
  });

  private readonly federationEnabled = toSignal(inject(FederationService).enabled(), {
    initialValue: false,
  });

  readonly scopes = computed(() => {
    this.translate.lang();
    return COMMUNITY_SCOPES.filter((id) => id !== 'REMOTE' || this.federationEnabled()).map(
      (id) => ({
        id,
        label: this.translate.get(`community.scope.${id}`),
      }),
    );
  });

  readonly sortItems = computed<MenuButtonItem[]>(() => {
    this.translate.lang();
    return (['RECENT', 'POPULAR'] as const).map((id) => ({
      id,
      label: this.translate.get(`community.sort.${id}`),
    }));
  });

  readonly filterCount = computed(
    () => (this.scope() !== 'ALL' ? 1 : 0) + (this.sort() !== 'RECENT' ? 1 : 0),
  );

  tile(on: boolean): string {
    return FILTER_TILE + ' ' + (on ? FILTER_TILE_ON : FILTER_TILE_OFF);
  }

  clearFilters(): void {
    this.navigate({ scope: null, sort: null });
  }

  readonly createKind = computed(() =>
    this.view() === 'lists' ? 'list' : this.view() === 'versus' ? 'versus' : 'review',
  );
  readonly createLabel = computed(() => `community.create_${this.createKind()}`);
  readonly emptyHint = computed(() => {
    const view = this.view();
    if (this.query().trim()) return 'community.empty.browse_hint';
    if (this.scope() === 'MINE') return `community.empty.browse_mine_${view}`;
    if (this.scope() === 'CIRCLE') return 'community.empty.browse_circle';
    if (this.scope() === 'REMOTE') return 'community.empty.browse_remote';
    return `community.empty.everyone_${view}`;
  });

  private readonly loadKey = computed(() =>
    [this.view(), this.scope(), this.sort(), this.query()].join('|'),
  );

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private reviewStarting = false;

  constructor() {
    this.layout.scrollTop.set(0);
    this.banner.load();

    this.destroyRef.onDestroy(() => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.layout.scrollTop.set(0);
    });

    effect(() => {
      const kind = this.creating();
      if (kind) {
        untracked(
          () =>
            void this.router.navigate([kind === 'list' ? '/lists/new' : '/versus/new'], {
              replaceUrl: true,
            }),
        );
      }
    });

    effect(() => {
      this.loadKey();
      if (this.landing()) return;
      untracked(() => this.loadView());
    });

    effect(() => {
      if (!this.landing()) return;
      this.signedIn();
      untracked(() => this.landingState.load());
    });

    effect(() => {
      const fromUrl = this.query();
      untracked(() => {
        if (fromUrl.trim() !== this.searchDraft().trim()) this.searchDraft.set(fromUrl);
      });
    });
  }

  selectView(id: string): void {
    if (id === 'overview') {
      this.navigate({ f: null, scope: null, sort: null, q: null }, false);
      this.scrollToBar();
      return;
    }
    const next = COMMUNITY_VIEWS.find((view) => view === id);
    if (!next) return;
    this.navigate({ ...tabParams(next, this.scope()), sort: null }, false);
    this.scrollToBar();
  }

  setScope(scope: CommunityScope): void {
    this.navigate({ scope: scopeParam(scope) });
  }

  setSort(sort: string): void {
    this.navigate({ sort: (sort as CommunitySort) === 'RECENT' ? null : sort });
  }

  onSearchInput(value: string): void {
    this.searchDraft.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(
      () => this.navigate({ q: value.trim() || null }),
      SEARCH_DEBOUNCE_MS,
    );
  }

  clearSearch(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchDraft.set('');
    this.navigate({ q: null });
  }

  onScroll(): void {
    const el = this.scrollContainer()?.nativeElement;
    if (!el) return;
    this.layout.scrollTop.set(el.scrollTop);
    this.browse.window.onScroll();
    const sentinel = this.sentinel()?.nativeElement;
    if (sentinel) {
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

  signIn(): void {
    this.authPrompt.show('/creations');
  }

  onDocumentKey(event: KeyboardEvent): void {
    if (event.key !== '/' || event.defaultPrevented) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    const input = this.searchInputs()
      .map((ref) => ref.nativeElement)
      .find((el) => el.offsetParent !== null);
    if (!input) return;
    event.preventDefault();
    input.focus();
  }

  onCreate(id: string): void {
    if (id === 'review') this.pickerOpen.set(true);
    else void this.router.navigate([id === 'list' ? '/lists/new' : '/versus/new']);
  }

  startReview(result: SearchResult): void {
    if (this.reviewStarting) return;
    this.reviewStarting = true;
    queueMicrotask(() => (this.reviewStarting = false));
    this.pickerOpen.set(false);
    const link = reviewStudioLink(result);
    void this.router.navigate(link.commands, { queryParams: link.queryParams });
  }

  findPeople(): void {
    void this.router.navigate(['/people'], { queryParams: { tab: 'discover' } });
  }

  retry(): void {
    this.loadView();
  }

  private loadView(): void {
    this.browse.window.reload();
  }

  private navigate(params: Record<string, string | null>, replace = true): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { f: this.view(), ...params },
      queryParamsHandling: 'merge',
      replaceUrl: replace,
    });
  }

  private scrollToBar(): void {
    const el = this.scrollContainer()?.nativeElement;
    const hero = el?.querySelector<HTMLElement>('shelfy-page-hero');
    if (!el || !hero) return;
    const target = hero.offsetHeight - (this.wide() ? 80 : 0);
    if (el.scrollTop > target) el.scrollTo({ top: Math.max(0, target) });
  }
}
