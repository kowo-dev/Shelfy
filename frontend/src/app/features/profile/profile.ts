import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { PageFooterComponent } from '@shared/ui/page-footer/page-footer';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  catchError,
  debounceTime,
  EMPTY,
  finalize,
  merge,
  of,
  Subject,
  switchMap,
  tap,
  type Observable,
} from 'rxjs';
import { toApiError } from '@app/core/errors/api-error';
import { CollectionService } from '@app/core/services/collection/collection';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@app/core/services/auth/auth';
import { AuthPromptService } from '@app/core/services/auth/auth-prompt';
import type {
  CollectionItemResponse,
  CollectionListParams,
  CollectionStatsResponse,
} from '@app/core/services/collection/collection.model';
import { PeopleService } from '@app/core/services/people/people';
import type { UserSearchResultResponse } from '@app/core/services/people/people.model';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import type { ProfileStats, UserProfileResponse } from '@app/core/services/people/people.model';
import { FollowsService } from '@app/core/services/follows/follows';
import { ListsService } from '@app/core/services/lists/lists';
import type { MediaListResponse } from '@app/core/services/lists/lists.model';
import type { VersusPoolSummaryResponse } from '@app/core/services/versus/versus.model';
import { VersusService } from '@app/core/services/versus/versus';
import { TranslateService } from '@app/core/services/translate/translate';
import { UserProfileService } from '@app/core/services/users/user-profile';
import type { ReviewResponse } from '@app/core/services/users/user-profile.model';
import { CelebrationService } from '@app/core/services/celebration/celebration';
import { ToastService } from '@app/core/services/toast/toast';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { AvatarComponent } from '@shared/ui/avatar/avatar';
import { BackLinkComponent, type BackTarget } from '@shared/ui/back-link/back-link';
import type { EssentialEntry } from '@app/core/services/essentials/essentials.model';
import { buttonClasses } from '@shared/ui/button/button';
import { IconComponent } from '@shared/ui/icon/icon';
import { ProfileEssentialsComponent } from './ui/profile-essentials/profile-essentials';
import { imageRendition } from '@shared/utils/image-rendition.util';
import { CreationTileComponent } from '@shared/ui/creation-card/creation-tile';
import { ReviewCardComponent } from '@shared/ui/creation-card/review-card';
import { ShelfSectionComponent } from '@shared/ui/shelf-section/shelf-section';
import { AmbientService } from '@app/core/services/ambient/ambient';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { statusLabelKey } from '@shared/utils/collection-status.util';
import { createHomeArt } from '../discover/data-access/home-art';
import { MediaCardComponent } from '@shared/ui/media-card/media-card';
import { HomeTileComponent } from '../discover/ui/home-tile/home-tile';
import { mergeCreations } from '@shared/utils/merge-creations.util';
import { formatRating, ratingToTextColor } from '@shared/utils/collection-rating.util';

type ProfileLoadState = 'loading' | 'ready' | 'private' | 'not_found' | 'error';

@Component({
  selector: 'shelfy-profile-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageFooterComponent,
    AvatarComponent,
    BackLinkComponent,
    IconComponent,
    ProfileEssentialsComponent,
    ShelfSectionComponent,
    HomeTileComponent,
    MediaCardComponent,
    ReviewCardComponent,
    CreationTileComponent,
    RouterLink,
    TranslatePipe,
  ],
  templateUrl: './profile.html',
})
export class ProfilePageComponent {
  private readonly auth = inject(AuthService);
  private readonly authPrompt = inject(AuthPromptService);
  private readonly route = inject(ActivatedRoute);
  private readonly userProfileService = inject(UserProfileService);
  private readonly followsService = inject(FollowsService);
  private readonly listsService = inject(ListsService);
  private readonly versusService = inject(VersusService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly celebration = inject(CelebrationService);
  private readonly errorMessage = inject(ErrorMessageService);
  private readonly translate = inject(TranslateService);
  private readonly collectionService = inject(CollectionService);
  private readonly peopleService = inject(PeopleService);

  readonly primaryPill = buttonClasses({ variant: 'primary' });
  readonly primaryButton = buttonClasses({ variant: 'primary', extraClass: 'gap-2.5' });
  readonly secondaryButton = buttonClasses({ variant: 'secondary', extraClass: 'gap-2.5' });
  private readonly ambient = inject(AmbientService);
  protected readonly art = createHomeArt({
    tmdb: inject(TmdbService),
    igdb: inject(IgdbService),
    brightness: (url) => this.ambient.brightnessOf(url),
  });
  private lastLoadedUsername: string | null = null;
  private readonly profileLoads = new Subject<string>();

  readonly currentUser = this.auth.currentUser;
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  readonly username = computed(
    () => this.params().get('username') ?? this.currentUser()?.username ?? '',
  );
  readonly profile = signal<UserProfileResponse | null>(null);
  readonly loadState = signal<ProfileLoadState>('loading');
  readonly privateUser = signal<UserSearchResultResponse | null>(null);
  readonly privateFollowPending = signal(false);
  readonly unavailableKey = computed(() => {
    const state = this.loadState();
    return state === 'private' || state === 'not_found' ? state : 'error';
  });
  readonly stats = signal<ProfileStats | null>(null);
  readonly shelfStats = signal<CollectionStatsResponse | null>(null);
  readonly shelfLoading = signal(true);
  readonly sectionsReady = signal(false);

  readonly listsCount = signal<number | null>(null);
  readonly lists = signal<MediaListResponse[]>([]);
  readonly pools = signal<VersusPoolSummaryResponse[]>([]);
  readonly poolsCount = signal(0);
  readonly reviews = signal<ReviewResponse[]>([]);
  readonly essentials = signal<EssentialEntry[]>([]);
  readonly nowItems = signal<CollectionItemResponse[]>([]);
  readonly finished = signal<CollectionItemResponse[]>([]);
  readonly creations = computed(() => mergeCreations(this.lists(), this.pools(), []));
  readonly creationsTotal = computed(
    () => (this.listsCount() ?? this.lists().length) + this.poolsCount(),
  );
  readonly bigStats = computed(() => {
    const username = this.profile()?.username;
    if (!username) return [];
    this.translate.lang();
    const shelf = this.shelfStats();
    const stats = this.stats();
    const average = shelf?.averageRating ?? null;
    const stat = (
      key: string,
      value: string | number,
      route: string,
      query: Record<string, string> | null,
      color: string | null = null,
    ) => ({
      key,
      value,
      label: this.translate.get('profile.stats.' + key),
      route,
      query,
      color,
      star: key === 'average_rating',
    });
    return [
      ...(shelf ? [stat('titles', shelf.total, this.collectionRoute(), null)] : []),
      ...(average
        ? [
            stat(
              'average_rating',
              formatRating(average),
              this.collectionRoute(),
              null,
              ratingToTextColor(average, 100),
            ),
          ]
        : []),
      stat('followers', stats?.followersCount ?? 0, `/profile/${username}/connections`, {
        tab: 'followers',
      }),
      stat('reviews', stats?.reviewsCount ?? 0, `/profile/${username}/lists`, { f: 'reviews' }),
      stat('lists', this.listsCount() ?? 0, `/profile/${username}/lists`, { f: 'lists' }),
    ];
  });

  readonly nowSubtitle = computed(() =>
    this.isOwner()
      ? this.translate.get('profile.now.sub_owner')
      : this.translate.get('profile.now.sub', { name: this.displayName() }),
  );

  readonly ambientCover = computed(() => {
    const url = this.essentials()[0]?.media.coverUrl ?? this.nowItems()[0]?.media.coverUrl;
    return url ? imageRendition(url, 'card') : null;
  });

  readonly collectionRouteParts = computed(() => [this.collectionRoute()]);

  private shortDate(iso: string): string {
    return new Intl.DateTimeFormat(this.translate.lang(), {
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso));
  }

  startedMeta(item: CollectionItemResponse): string {
    const type = this.translate.get('collection.media_type_one.' + item.media.mediaType);
    const started = this.translate.get('profile.now.started', {
      date: this.shortDate(item.createdAt),
    });
    return `${type} · ${started}`;
  }

  finishedMeta(item: CollectionItemResponse): string {
    const done = this.translate.get(statusLabelKey('done', item.media.mediaType));
    return `${done} ${this.shortDate(item.updatedAt)}`;
  }

  private shelfSections$(username: string): Observable<unknown> {
    const owner = this.currentUser()?.username === username;
    const list = (params: CollectionListParams) =>
      owner
        ? this.collectionService.list(params)
        : this.collectionService.listForUser(username, params);
    return merge(
      list({ status: ['ongoing'], size: 6, sortBy: 'updatedAt', sortDirection: 'desc' }).pipe(
        catchError(() => of(null)),
        tap((page) => this.nowItems.set(page?.content ?? [])),
      ),
      list({ status: ['done'], size: 10, sortBy: 'updatedAt', sortDirection: 'desc' }).pipe(
        catchError(() => of(null)),
        tap((page) => this.finished.set(page?.content ?? [])),
      ),
    );
  }
  readonly followPending = signal(false);
  readonly unfollowPending = signal(false);
  readonly isOwner = computed(() => {
    const me = this.currentUser();
    return !!me && this.profile()?.id === me.id;
  });

  readonly back = computed<BackTarget | null>(() => {
    this.translate.lang();
    if (!this.currentUser() || this.isOwner()) return null;
    return { to: ['/people'], label: this.translate.get('nav.people') };
  });

  readonly displayName = computed(() => {
    const profile = this.profile();
    return profile?.displayName ?? profile?.username ?? '';
  });
  constructor() {
    this.profileLoads
      .pipe(
        switchMap((username) => this.fetchProfile(username)),
        takeUntilDestroyed(),
      )
      .subscribe();
    this.collectionService.changes
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe(() => this.refreshShelf());
    effect(() => {
      const username = this.username();
      if (!username || username === this.lastLoadedUsername) return;
      this.lastLoadedUsername = username;
      this.profile.set(null);
      this.stats.set(null);
      this.privateUser.set(null);
      this.loadState.set('loading');
      this.listsCount.set(null);
      this.lists.set([]);
      this.pools.set([]);
      this.poolsCount.set(0);
      this.reviews.set([]);
      this.essentials.set([]);
      this.nowItems.set([]);
      this.finished.set([]);
      this.shelfStats.set(null);
      this.shelfLoading.set(true);
      this.sectionsReady.set(false);
      this.loadProfile(username);
    });
  }

  private loadProfile(username: string): void {
    this.profileLoads.next(username);
  }

  private fetchProfile(username: string): Observable<unknown> {
    const profile$ = this.userProfileService.getProfile(username).pipe(
      tap((profile) => {
        this.profile.set(profile);
        this.loadState.set('ready');
        this.stats.set(profile.stats);
      }),
      switchMap((profile) =>
        this.fetchProfileSections(profile.username).pipe(
          finalize(() => {
            if (this.lastLoadedUsername === username) this.sectionsReady.set(true);
          }),
        ),
      ),
      catchError((error: unknown) => this.onProfileError(username, error)),
    );
    return merge(this.shelfStats$(username), profile$);
  }

  private fetchProfileSections(username: string): Observable<unknown> {
    return merge(
      this.shelfSections$(username),
      this.listsService.forProfile(username).pipe(
        tap((response) => {
          this.listsCount.set(response.totalElements);
          this.lists.set(response.content);
        }),
        catchError(() => {
          this.listsCount.set(null);
          return EMPTY;
        }),
      ),
      this.versusService.profilePools(username).pipe(
        catchError(() => of(null)),
        tap((response) => {
          this.pools.set(response?.content ?? []);
          this.poolsCount.set(response?.totalElements ?? 0);
        }),
      ),
      this.userProfileService.getEssentials(username).pipe(
        catchError(() => of([])),
        tap((entries) => this.essentials.set(entries)),
      ),
      this.userProfileService.getReviews(username, 0, 8).pipe(
        tap((response) => this.reviews.set(response.content)),
        catchError(() => {
          this.reviews.set([]);
          return EMPTY;
        }),
      ),
    );
  }

  private onProfileError(username: string, error: unknown): Observable<unknown> {
    const api = toApiError(error);
    this.shelfStats.set(null);
    if (api.status === 403 && api.code === 'PROFILE_PRIVATE') {
      this.loadState.set('private');
      return this.lookupPrivateUser(username);
    }
    this.loadState.set(api.status === 404 || api.code === 'USER_NOT_FOUND' ? 'not_found' : 'error');
    return EMPTY;
  }

  private lookupPrivateUser(username: string): Observable<unknown> {
    if (!this.currentUser()) return EMPTY;
    return this.peopleService.search(username, 0, 5).pipe(
      catchError(() => of(null)),
      tap((page) => {
        const match = page?.content.find(
          (user) => user.username.toLowerCase() === username.toLowerCase(),
        );
        this.privateUser.set(match ?? null);
      }),
    );
  }

  followPrivate(): void {
    const user = this.privateUser();
    if (!user || this.privateFollowPending()) return;
    this.privateFollowPending.set(true);
    this.followsService.follow(user.id).subscribe({
      next: () => {
        this.privateFollowPending.set(false);
        this.toastService.success(this.translate.get('profile.follow.followed'));
        this.loadState.set('loading');
        this.loadProfile(user.username);
      },
      error: (error: unknown) => {
        this.privateFollowPending.set(false);
        catchAndToastError(this.toastService, this.errorMessage)(error);
      },
    });
  }

  private shelfStats$(username: string): Observable<unknown> {
    return this.collectionService.statsForUser(username).pipe(
      catchError(() => of(null)),
      tap((stats) => {
        this.shelfStats.set(stats);
        this.shelfLoading.set(false);
      }),
    );
  }

  private refreshShelf(): void {
    const username = this.profile()?.username;
    if (!username) return;
    this.shelfStats$(username).subscribe();
    this.shelfSections$(username).subscribe();
    const onError = catchAndToastError(this.toastService, this.errorMessage);
    this.userProfileService.getProfile(username).subscribe({
      next: (profile) => this.stats.set(profile.stats),
      error: onError,
    });
    this.userProfileService.getEssentials(username).subscribe({
      next: (entries) => this.essentials.set(entries),
      error: onError,
    });
  }

  editProfile(): void {
    if (!this.isOwner()) return;
    void this.router.navigate(['/settings'], { queryParams: { section: 'profile' } });
  }

  compare(event: Event): void {
    if (this.currentUser()) return;
    event.preventDefault();
    this.authPrompt.show(this.router.url);
  }

  readonly collectionRoute = computed(() =>
    this.isOwner() ? '/collection' : `/users/${this.profile()?.username ?? ''}`,
  );

  follow(): void {
    const profile = this.profile();
    if (!profile || this.isOwner() || profile.isFollowedByCurrentUser || this.followPending())
      return;
    if (!this.currentUser()) {
      this.authPrompt.show(
        this.router.url,
        profile.username.includes('@') ? null : profile.username,
      );
      return;
    }

    this.followPending.set(true);
    this.followsService.follow(profile.id).subscribe({
      next: () => {
        this.profile.update((current) =>
          current ? { ...current, isFollowedByCurrentUser: true } : current,
        );
        this.stats.update((current) =>
          current ? { ...current, followersCount: current.followersCount + 1 } : current,
        );
        this.followPending.set(false);
        this.celebration.fire('social');
        this.toastService.success(this.translate.get('profile.follow.followed'));
      },
      error: (error: unknown) => {
        this.followPending.set(false);
        catchAndToastError(this.toastService, this.errorMessage)(error);
      },
    });
  }

  unfollow(): void {
    const profile = this.profile();
    if (!profile || !profile.isFollowedByCurrentUser || this.unfollowPending()) return;

    this.unfollowPending.set(true);
    this.followsService.unfollow(profile.id).subscribe({
      next: () => {
        this.profile.update((current) =>
          current ? { ...current, isFollowedByCurrentUser: false } : current,
        );
        this.stats.update((current) =>
          current
            ? { ...current, followersCount: Math.max(0, current.followersCount - 1) }
            : current,
        );
        this.unfollowPending.set(false);
        this.toastService.success(this.translate.get('profile.follow.unfollowed'));
      },
      error: (error: unknown) => {
        this.unfollowPending.set(false);
        catchAndToastError(this.toastService, this.errorMessage)(error);
      },
    });
  }
}
