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
  type WritableSignal,
} from '@angular/core';
import { PageFooterComponent } from '@shared/ui/page-footer/page-footer';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  type Observable,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  switchMap,
} from 'rxjs';
import { AuthService } from '@app/core/services/auth/auth';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { LayoutService } from '@app/core/services/layout/layout';
import { FollowsService } from '@app/core/services/follows/follows';
import { PeopleService } from '@app/core/services/people/people';
import type {
  UserProfileResponse,
  UserSearchResultResponse,
} from '@app/core/services/people/people.model';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { UserProfileService } from '@app/core/services/users/user-profile';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { ButtonComponent, buttonClasses } from '@shared/ui/button/button';
import { IconComponent } from '@shared/ui/icon/icon';
import { TabsComponent, type TabItem } from '@shared/ui/tabs/tabs';
import { ActivityFeedComponent } from './activity-feed';
import { PageHeroComponent } from '@shared/ui/page-hero/page-hero';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';

import {
  EMPTY_COPY,
  FOLLOW,
  OWNER_TABS,
  PAGE,
  TAB_LABEL,
  VISITOR_TABS,
  emptyPage,
  fromPopularUser,
  fromUser,
  people,
  toConnectionView,
  type Connection,
  type ConnectionAction,
  type ConnectionsPage,
  type ConnectionsTab,
  type ConnectionView,
  type PagedPeople,
  type ViewContext,
} from './connections';
import { PersonCardComponent } from './person-card';

@Component({
  selector: 'shelfy-profile-connections-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TabsComponent,
    ActivityFeedComponent,
    PageFooterComponent,
    NgTemplateOutlet,
    RouterLink,
    TranslatePipe,
    ButtonComponent,
    IconComponent,
    PageHeroComponent,
    PersonCardComponent,
  ],
  templateUrl: './profile-connections.html',
})
export class ProfileConnectionsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly userProfileService = inject(UserProfileService);
  private readonly followsService = inject(FollowsService);
  private readonly peopleService = inject(PeopleService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly layout = inject(LayoutService);
  private readonly onError = catchAndToastError(this.toast, inject(ErrorMessageService));

  readonly scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');

  protected readonly notFoundLink = buttonClasses({ variant: 'secondary' });
  protected readonly grid = 'v-pgrid';
  protected readonly followButton = buttonClasses({
    variant: 'primary',
    size: 'sm',
    extraClass: 'shrink-0',
  });
  protected readonly followingButton = buttonClasses({
    variant: 'secondary',
    size: 'sm',
    extraClass: 'shrink-0',
  });
  readonly stuck = signal(false);
  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');
  protected readonly skeletonSlots = [0, 1, 2, 3, 4, 5];

  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  private readonly queryParams = toSignal(this.route.queryParamMap, { requireSync: true });
  readonly username = computed(
    () => this.params().get('username') ?? this.auth.currentUser()?.username ?? '',
  );

  readonly profile = signal<UserProfileResponse | null>(null);
  readonly notFound = signal(false);
  readonly isOwner = computed(() => {
    const me = this.auth.currentUser();
    return !!me && this.profile()?.id === me.id;
  });
  readonly displayName = computed(() => {
    const profile = this.profile();
    return profile?.displayName || profile?.username || this.username();
  });
  readonly heroTitle = computed(() => {
    this.translate.lang();
    const own = this.username() === this.auth.currentUser()?.username;
    return own
      ? this.translate.get('nav.people')
      : this.translate.get('connections.title_of', { name: this.displayName() });
  });

  readonly tabIds = computed(() => (this.isOwner() ? OWNER_TABS : VISITOR_TABS));
  readonly tab = computed<ConnectionsTab>(() => {
    const requested = this.queryParams().get('tab') as ConnectionsTab | null;
    const ids = this.tabIds();
    if (requested && ids.includes(requested)) return requested;
    return ids[0];
  });

  private readonly pages: Record<ConnectionsTab, WritableSignal<ConnectionsPage>> = {
    activity: signal(emptyPage()),
    favorites: signal(emptyPage()),
    following: signal(emptyPage()),
    followers: signal(emptyPage()),
    discover: signal(emptyPage()),
  };
  readonly current = computed(() => this.pages[this.tab()]());
  readonly empty = computed(() => {
    const copy = EMPTY_COPY[this.tab()];
    return { title: copy.title, body: this.isOwner() ? copy.mine : copy.theirs };
  });

  private readonly myFollowing = signal<ReadonlySet<string>>(new Set());
  private readonly myFollowers = signal<ReadonlySet<string>>(new Set());
  readonly myFavorites = signal<ReadonlySet<string>>(new Set());
  readonly busy = signal<ReadonlySet<string>>(new Set());

  readonly query = signal('');
  readonly searchTerm = computed(() => this.query().trim());
  readonly searching = signal(false);
  readonly results = signal<UserSearchResultResponse[]>([]);
  private readonly query$ = new Subject<string>();

  readonly tabs = computed<TabItem[]>(() => {
    this.translate.lang();
    return this.tabIds().map((id) => {
      const page = this.pages[id]();
      return {
        id,
        label: this.translate.get(TAB_LABEL[id]),
        count: page.loaded && id !== 'discover' && id !== 'activity' ? page.total : null,
      };
    });
  });

  readonly heroStats = computed(() => {
    const following = this.pages.following();
    const followers = this.pages.followers();
    const followerCount = followers.loaded
      ? followers.total
      : (this.profile()?.stats?.followersCount ?? null);
    return {
      following: following.loaded ? following.total : null,
      followers: followerCount,
    };
  });

  readonly resultCount = computed(() => {
    if (this.searchTerm()) return this.searching() ? null : this.results().length;
    const page = this.current();
    return page.loaded && page.people.length ? page.total : null;
  });

  readonly people = computed<ConnectionView[]>(() => {
    const context: ViewContext = {
      tab: this.tab(),
      owner: this.isOwner(),
      me: this.auth.currentUser()?.id,
      following: this.myFollowing(),
      followers: this.myFollowers(),
    };
    return this.current().people.map((person) => toConnectionView(person, context));
  });

  readonly resultViews = computed<ConnectionView[]>(() => {
    const me = this.auth.currentUser()?.id;
    return this.results().map((result) => {
      const followed = result.isFollowedByCurrentUser || this.myFollowing().has(result.id);
      return {
        ...fromUser(result),
        noteKey: followed ? 'community.people.you_follow' : null,
        action: followed || !me || result.id === me ? null : FOLLOW,
      };
    });
  });

  constructor() {
    this.layout.scrollTop.set(0);
    inject(DestroyRef).onDestroy(() => this.layout.scrollTop.set(0));
    effect(() => {
      const username = this.username();
      untracked(() => this.loadProfile(username));
    });
    effect(() => {
      const tab = this.tab();
      if (!this.profile() || tab === 'activity') return;
      untracked(() => {
        if (!this.pages[tab]().loaded) this.load(tab);
      });
    });
    this.query$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((value) => {
          const trimmed = value.trim();
          this.searching.set(!!trimmed);
          return trimmed
            ? this.peopleService.search(trimmed, 0, 24).pipe(
                map((page) => page.content),
                catchError((error: unknown) => {
                  this.onError(error);
                  return of([]);
                }),
              )
            : of([]);
        }),
        takeUntilDestroyed(),
      )
      .subscribe((results) => {
        this.results.set(results);
        this.searching.set(false);
      });
    const initial = this.queryParams().get('q');
    if (initial) this.onQuery(initial);
  }

  selectTab(tab: string): void {
    if (this.query()) this.clearQuery();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onQuery(value: string): void {
    this.query.set(value);
    this.query$.next(value);
  }

  clearQuery(): void {
    this.onQuery('');
  }

  canFavorite(person: Connection): boolean {
    return this.myFollowing().has(person.userId);
  }

  isFavorite(person: Connection): boolean {
    return this.myFavorites().has(person.userId);
  }

  toggleFavorite(person: ConnectionView): void {
    const next = !this.isFavorite(person);
    this.setFavorite(person.userId, next);
    const request = next
      ? this.followsService.favorite(person.userId)
      : this.followsService.unfavorite(person.userId);
    this.run(
      person,
      request,
      () => {
        if (!this.isOwner()) return;
        for (const tab of ['favorites', 'following'] as const) {
          this.pages[tab].set(emptyPage());
          this.load(tab);
        }
      },
      () => this.setFavorite(person.userId, !next),
    );
  }

  private setFavorite(userId: string, favorite: boolean): void {
    this.myFavorites.update((ids) => {
      const next = new Set(ids);
      if (favorite) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }

  onScroll(): void {
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

  load(tab: ConnectionsTab): void {
    const profile = this.profile();
    const state = this.pages[tab];
    if (!profile || state().loading) return;
    const page = Math.floor(state().people.length / PAGE);
    state.update((current) => ({ ...current, loading: true }));
    this.request(tab, profile.id, page).subscribe({
      next: (response) => {
        if (this.profile()?.id !== profile.id) return;
        state.update((current) => ({
          people: [...current.people, ...response.content],
          total: response.totalElements,
          loading: false,
          loaded: true,
        }));
      },
      error: (error: unknown) => {
        state.update((current) => ({ ...current, loading: false, loaded: true }));
        this.onError(error);
      },
    });
  }

  act(person: ConnectionView, action: ConnectionAction): void {
    switch (action.kind) {
      case 'follow':
        return this.follow(person);
      case 'unfollow':
        return this.unfollow(person);
    }
  }

  private follow(person: ConnectionView): void {
    this.run(person, this.followsService.follow(person.userId), () => {
      this.myFollowing.update((ids) => new Set(ids).add(person.userId));
      if (this.isOwner()) this.pages.following.set(emptyPage());
      if (this.tab() === 'discover') this.drop('discover', person);
      this.toast.success(this.translate.get('profile.follow.followed'));
    });
  }

  private unfollow(person: ConnectionView): void {
    this.run(person, this.followsService.unfollow(person.userId), () => {
      this.drop('following', person);
      if (this.isFavorite(person)) this.drop('favorites', person);
      this.setFavorite(person.userId, false);
      this.myFollowing.update((ids) => {
        const next = new Set(ids);
        next.delete(person.userId);
        return next;
      });
      this.toast.success(this.translate.get('profile.follow.unfollowed'));
    });
  }

  private loadProfile(username: string): void {
    this.profile.set(null);
    this.notFound.set(false);
    for (const page of Object.values(this.pages)) page.set(emptyPage());
    if (!username) return;
    this.userProfileService.getProfile(username).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.loadRelations();
        for (const tab of this.tabIds()) if (tab !== 'activity') this.load(tab);
      },
      error: () => this.notFound.set(true),
    });
  }

  private loadRelations(): void {
    if (!this.auth.currentUser()) return;
    const ids = (page: PagedPeople) => new Set(page.content.map((person) => person.userId));
    this.request('following', '', 0, 500).subscribe({
      next: (page) => {
        this.myFollowing.set(ids(page));
        this.myFavorites.set(
          new Set(page.content.filter((person) => person.favorite).map((person) => person.userId)),
        );
      },
      error: () => this.myFollowing.set(new Set()),
    });
    if (this.isOwner()) {
      this.request('followers', '', 0, 500).subscribe({
        next: (page) => this.myFollowers.set(ids(page)),
        error: () => this.myFollowers.set(new Set()),
      });
    }
  }

  private request(
    tab: ConnectionsTab,
    userId: string,
    page: number,
    size = PAGE,
  ): Observable<PagedPeople> {
    const own = !userId || this.isOwner();
    switch (tab) {
      case 'discover':
        return people(this.followsService.popular(page, size), fromPopularUser);
      case 'favorites':
        return people(this.followsService.favorites(page, size), fromUser);
      case 'followers':
        return people(
          own
            ? this.followsService.followers(page, size)
            : this.followsService.followersOf(userId, page, size),
          fromUser,
        );
      default:
        return people(
          own
            ? this.followsService.following(page, size)
            : this.followsService.followingOf(userId, page, size),
          fromUser,
        );
    }
  }

  private drop(tab: ConnectionsTab, person: Connection): void {
    this.pages[tab].update((page) => ({
      ...page,
      people: page.people.filter((item) => item.key !== person.key),
      total: Math.max(0, page.total - 1),
    }));
  }

  private run(
    person: Connection,
    request: Observable<unknown>,
    done: () => void,
    failed?: () => void,
  ): void {
    const mark = (on: boolean) =>
      this.busy.update((keys) => {
        const next = new Set(keys);
        if (on) next.add(person.key);
        else next.delete(person.key);
        return next;
      });
    mark(true);
    request.subscribe({
      next: () => {
        mark(false);
        done();
      },
      error: (error: unknown) => {
        mark(false);
        failed?.();
        this.onError(error);
      },
    });
  }
}
