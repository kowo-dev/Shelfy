import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  type ElementRef,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, filter, forkJoin, map, of, switchMap } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@app/core/services/auth/auth';
import { ListsService } from '@app/core/services/lists/lists';
import { UserProfileService } from '@app/core/services/users/user-profile';
import type { ReviewResponse } from '@app/core/services/users/user-profile.model';
import { VersusService } from '@app/core/services/versus/versus';
import type { VersusPoolSummaryResponse } from '@app/core/services/versus/versus.model';
import { mergeCreations } from '@shared/utils/merge-creations.util';
import { CreationTileComponent } from '@shared/ui/creation-card/creation-tile';
import { ReviewCardComponent } from '@shared/ui/creation-card/review-card';
import { BackLinkComponent, type BackTarget } from '@shared/ui/back-link/back-link';
import { PageHeroComponent } from '@shared/ui/page-hero/page-hero';
import { TabsComponent } from '@shared/ui/tabs/tabs';
import { IconComponent } from '@shared/ui/icon/icon';
import { createPosterWall } from '@shared/utils/poster-wall.util';
import type { MediaListResponse } from '@app/core/services/lists/lists.model';
import {
  isVisibleMediaType,
  type MediaResponse,
  type PagedResponse,
} from '@app/core/services/collection/collection.model';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { TranslateService } from '@app/core/services/translate/translate';
import { MenuButtonComponent, type MenuButtonItem } from '@shared/ui/menu-button/menu-button';
import { ButtonComponent, buttonClasses } from '@shared/ui/button/button';
import { SECTION_TITLE } from '@shared/ui/ui-recipes';

const REVIEWS_PAGE_SIZE = 50;
const WALL_SIZE = 30;

type LibraryFilter = 'all' | 'reviews' | 'lists' | 'versus';

@Component({
  selector: 'shelfy-lists-library-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BackLinkComponent,
    TranslatePipe,
    CreationTileComponent,
    ReviewCardComponent,
    IconComponent,
    MenuButtonComponent,
    ButtonComponent,
    PageHeroComponent,
    TabsComponent,
  ],
  templateUrl: './lists-library.html',
})
export class ListsLibraryPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly listsService = inject(ListsService);
  private readonly versusService = inject(VersusService);
  private readonly profiles = inject(UserProfileService);
  private readonly translate = inject(TranslateService);
  private readonly trending = createPosterWall();
  readonly primaryClass = buttonClasses({ variant: 'primary', extraClass: 'gap-2.5' });
  protected readonly sectionTitle = SECTION_TITLE;
  protected readonly skeletonSlots = [1, 2, 3, 4, 5, 6];
  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');
  readonly stuck = signal(false);
  private loadedUsername: string | null = null;
  private fetchedQuery = '';

  readonly lists = signal<MediaListResponse[]>([]);
  readonly pools = signal<VersusPoolSummaryResponse[]>([]);
  readonly reviews = signal<ReviewResponse[]>([]);
  readonly reviewsTotal = signal(0);
  readonly reviewsLoadingMore = signal(false);
  private reviewsPage = 0;
  readonly hasMoreReviews = computed(() => this.reviews().length < this.reviewsTotal());
  readonly counts = signal({ reviews: 0, lists: 0, versus: 0 });
  readonly total = computed(() => {
    const { reviews, lists, versus } = this.counts();
    return reviews + lists + versus;
  });
  readonly kindCount = computed(() => Object.values(this.counts()).filter((n) => n > 0).length);
  private readonly queryParams = toSignal(this.route.queryParamMap, { requireSync: true });
  private readonly selected = linkedSignal<LibraryFilter>(() => {
    this.profileUsername();
    const requested = this.queryParams().get('f') ?? this.params().get('kind');
    return requested === 'reviews' || requested === 'lists' || requested === 'versus'
      ? requested
      : 'all';
  });
  readonly filter = computed<LibraryFilter>(() => {
    const selected = this.selected();
    return selected === 'all' || this.counts()[selected] > 0 ? selected : 'all';
  });
  readonly filterTabs = computed(() => {
    this.translate.lang();
    return [
      { id: 'all', label: this.translate.get('lists.filters.all'), count: this.total() },
      {
        id: 'reviews',
        label: this.translate.get('review.list.title'),
        count: this.counts().reviews,
      },
      {
        id: 'lists',
        label: this.translate.get('lists.filters.lists'),
        count: this.counts().lists,
      },
      {
        id: 'versus',
        label: this.translate.get('lists.filters.versus'),
        count: this.counts().versus,
      },
    ];
  });
  readonly query = signal('');
  readonly heroStats = computed(() =>
    [
      { key: 'review.list.title', count: this.counts().reviews },
      { key: 'lists.filters.lists', count: this.counts().lists },
      { key: 'lists.filters.versus', count: this.counts().versus },
    ].filter((stat) => stat.count > 0),
  );
  readonly wall = computed(() => {
    const coverOf = (media: MediaResponse | null) =>
      media && !media.isAdult && isVisibleMediaType(media.mediaType) ? media.coverUrl : null;
    const covers = [
      ...this.reviews().map((review) => coverOf(review.media)),
      ...this.lists().flatMap((list) => list.media.map(coverOf)),
      ...this.pools().flatMap((pool) => pool.previewEntries.map((entry) => coverOf(entry.media))),
    ].filter((url): url is string => !!url);
    if (this.loading()) return [];
    if (covers.length < WALL_SIZE && this.trending.posters().length === 0) return [];
    return [...new Set([...covers, ...this.trending.posters()])].slice(0, WALL_SIZE);
  });
  readonly creations = computed(() => {
    const filter = this.filter();
    return mergeCreations(
      filter === 'versus' || filter === 'reviews' ? [] : this.lists(),
      filter === 'lists' || filter === 'reviews' ? [] : this.pools(),
      filter === 'lists' || filter === 'versus' ? [] : this.reviews(),
    );
  });
  readonly groups = computed(() =>
    [
      {
        id: 'made',
        title: 'profile.creations.title',
        items: this.creations().filter((creation) => creation.kind !== 'review'),
      },
      {
        id: 'reviews',
        title: 'review.list.title',
        items: this.creations().filter((creation) => creation.kind === 'review'),
      },
    ].filter((group) => group.items.length > 0),
  );
  readonly loading = signal(true);
  readonly profileFailed = signal(false);
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  readonly profileUsername = computed(
    () => this.params().get('username') ?? this.auth.currentUser()?.username ?? '',
  );
  readonly isOwner = computed(
    () => this.profileUsername().toLowerCase() === this.auth.currentUser()?.username.toLowerCase(),
  );

  readonly createItems = computed<MenuButtonItem[]>(() => {
    this.translate.lang();
    return [
      { id: 'list', icon: 'lists', label: this.translate.get('community.create_list') },
      { id: 'versus', icon: 'compare', label: this.translate.get('community.create_versus') },
    ];
  });

  constructor() {
    this.trending.load();
    effect(() => {
      const username = this.profileUsername();
      if (!username || username === this.loadedUsername) return;
      this.loadedUsername = username;
      this.loadProfile(username);
    });
    if (!this.profileUsername()) this.loading.set(false);
    toObservable(this.query)
      .pipe(
        debounceTime(250),
        map((query) => query.trim()),
        filter((query) => query !== this.fetchedQuery),
        switchMap((query) =>
          this.fetch(this.profileUsername(), query).pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => result && this.show(result));
    this.bindStuck();
  }

  private bindStuck(): void {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const sentinel = this.sentinel()?.nativeElement;
      if (!sentinel || typeof IntersectionObserver === 'undefined') return;
      const nav =
        window.innerWidth >= 768
          ? parseFloat(
              getComputedStyle(document.documentElement).getPropertyValue('--nav-bar-height'),
            ) || 76
          : 0;
      const observer = new IntersectionObserver(
        ([entry]) => this.stuck.set(!entry.isIntersecting && entry.boundingClientRect.top < nav),
        { root: document.querySelector('.app-main'), rootMargin: `-${nav}px 0px 0px 0px` },
      );
      observer.observe(sentinel);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private fetch(username: string, query: string) {
    this.fetchedQuery = query;
    return forkJoin({
      lists: this.listsService.forProfile(username, query),
      pools: this.versusService
        .profilePools(username, 0, 50, query)
        .pipe(catchError(() => of(null))),
      reviews: this.profiles
        .getReviews(username, 0, REVIEWS_PAGE_SIZE, query)
        .pipe(catchError(() => of(null))),
    });
  }

  private show(result: {
    lists: PagedResponse<MediaListResponse>;
    pools: PagedResponse<VersusPoolSummaryResponse> | null;
    reviews: PagedResponse<ReviewResponse> | null;
  }): void {
    this.lists.set(result.lists.content);
    this.pools.set(result.pools?.content ?? []);
    this.reviews.set(result.reviews?.content ?? []);
    this.reviewsTotal.set(result.reviews?.totalElements ?? 0);
    this.reviewsPage = 0;
  }

  private loadProfile(username: string): void {
    this.loading.set(true);
    this.profileFailed.set(false);
    this.query.set('');
    this.fetch(username, '').subscribe({
      next: (result) => {
        this.show(result);
        this.counts.set({
          reviews: result.reviews?.totalElements ?? 0,
          lists: result.lists.totalElements,
          versus: result.pools?.totalElements ?? 0,
        });
        this.loading.set(false);
      },
      error: () => {
        this.profileFailed.set(true);
        this.loading.set(false);
      },
    });
  }

  setFilter(filter: string): void {
    this.selected.set(filter as LibraryFilter);
  }

  loadMoreReviews(): void {
    if (this.reviewsLoadingMore() || !this.hasMoreReviews()) return;
    this.reviewsLoadingMore.set(true);
    const nextPage = this.reviewsPage + 1;
    this.profiles
      .getReviews(this.profileUsername(), nextPage, REVIEWS_PAGE_SIZE, this.query().trim())
      .subscribe({
        next: (response) => {
          this.reviewsPage = nextPage;
          this.reviews.update((current) => [...current, ...response.content]);
          this.reviewsTotal.set(response.totalElements);
          this.reviewsLoadingMore.set(false);
        },
        error: () => this.reviewsLoadingMore.set(false),
      });
  }

  onCreate(id: string): void {
    void this.router.navigate([id === 'list' ? '/lists/new' : '/versus/new']);
  }

  retry(): void {
    this.loadedUsername = null;
    const username = this.profileUsername();
    if (!username) return;
    this.loadProfile(username);
  }

  readonly profileLink = computed(() =>
    this.isOwner() ? '/profile' : ['/profile', this.profileUsername()],
  );

  readonly back = computed<BackTarget>(() => {
    this.translate.lang();
    return this.isOwner()
      ? { to: ['/profile'], label: this.translate.get('nav.profile') }
      : { to: ['/profile', this.profileUsername()], label: this.profileUsername() };
  });

  readonly bandTitle = computed(() =>
    this.isOwner()
      ? this.translate.get('profile.made.title_owner')
      : this.translate.get('profile.made.title', { name: this.profileUsername() }),
  );
}
