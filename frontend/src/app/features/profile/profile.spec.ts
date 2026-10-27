import { of, Subject, throwError, type Observable } from 'rxjs';
import { vi } from 'vitest';

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AmbientService } from '@app/core/services/ambient/ambient';
import { AuthService } from '@app/core/services/auth/auth';
import { AuthPromptService } from '@app/core/services/auth/auth-prompt';
import { FollowsService } from '@app/core/services/follows/follows';
import { ApiError } from '@app/core/errors/api-error';
import { CollectionService } from '@app/core/services/collection/collection';
import { PeopleService } from '@app/core/services/people/people';
import { ListsService } from '@app/core/services/lists/lists';
import { VersusService } from '@app/core/services/versus/versus';
import { UserProfileService } from '@app/core/services/users/user-profile';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { TranslateService } from '@app/core/services/translate/translate';
import type { UserProfileResponse } from '@app/core/services/people/people.model';

import { ProfilePageComponent } from './profile';
import { EssentialsService } from '@app/core/services/essentials/essentials';
import type { EssentialEntry } from '@app/core/services/essentials/essentials.model';

function profile(overrides: Partial<UserProfileResponse> = {}): UserProfileResponse {
  return {
    id: 'user-1',
    username: 'kowo',
    displayName: null,
    profileVisibility: 'public',
    isFollowedByCurrentUser: false,
    ongoingItems: [],
    stats: { totalItems: 10, averageRating: 8.4, followersCount: 3, reviewsCount: 2 },
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  } as unknown as UserProfileResponse;
}

describe('ProfilePageComponent', () => {
  let userProfileService: {
    getProfile: ReturnType<typeof vi.fn>;
    getActivity: ReturnType<typeof vi.fn>;
    getReviews: ReturnType<typeof vi.fn>;
    getEssentials: ReturnType<typeof vi.fn>;
  };
  let followsService: { follow: ReturnType<typeof vi.fn>; unfollow: ReturnType<typeof vi.fn> };
  let listsService: { forProfile: ReturnType<typeof vi.fn> };
  let versusService: { profilePools: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let friendsService: { search: ReturnType<typeof vi.fn> };

  function setup(
    currentUserId: string | null = 'user-1',
    overrides: Partial<UserProfileResponse> = {},
    profileError: ApiError | null = null,
    made: {
      lists?: Observable<unknown>;
      pools?: Observable<unknown>;
      reviews?: Observable<unknown>;
    } = {},
  ) {
    userProfileService = {
      getProfile: vi
        .fn()
        .mockReturnValue(profileError ? throwError(() => profileError) : of(profile(overrides))),
      getActivity: vi.fn().mockReturnValue(of({ content: [] })),
      getReviews: vi.fn().mockReturnValue(made.reviews ?? of({ content: [] })),
      getEssentials: vi.fn().mockReturnValue(of([])),
    };
    followsService = {
      follow: vi.fn().mockReturnValue(of(undefined)),
      unfollow: vi.fn().mockReturnValue(of(undefined)),
    };
    listsService = {
      forProfile: vi.fn().mockReturnValue(made.lists ?? of({ content: [], totalElements: 0 })),
    };
    versusService = {
      profilePools: vi.fn().mockReturnValue(made.pools ?? of({ content: [], totalElements: 0 })),
    };
    router = { navigate: vi.fn() };
    toastService = { success: vi.fn(), error: vi.fn() };
    friendsService = { search: vi.fn().mockReturnValue(of({ content: [] })) };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ProfilePageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ username: 'kowo' })) },
        },
        { provide: Router, useValue: router },
        {
          provide: AuthService,
          useValue: { currentUser: () => (currentUserId ? { id: currentUserId } : null) },
        },
        { provide: PeopleService, useValue: friendsService },
        {
          provide: CollectionService,
          useValue: {
            statsForUser: vi.fn().mockReturnValue(of(null)),
            list: vi.fn().mockReturnValue(of({ content: [], totalElements: 0 })),
            listForUser: vi.fn().mockReturnValue(of({ content: [], totalElements: 0 })),
            changes: new Subject(),
          },
        },
        { provide: UserProfileService, useValue: userProfileService },
        { provide: FollowsService, useValue: followsService },
        { provide: ListsService, useValue: listsService },
        { provide: VersusService, useValue: versusService },
        { provide: ToastService, useValue: toastService },
        { provide: ErrorMessageService, useValue: { fromApiError: () => 'error' } },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    TestBed.overrideComponent(ProfilePageComponent, { set: { template: '<div></div>' } });

    const fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('loads the profile for the route username and derives stats', () => {
    const fixture = setup();
    const component = fixture.componentInstance;

    expect(userProfileService.getProfile).toHaveBeenCalledWith('kowo');
    expect(component.profile()?.username).toBe('kowo');
    expect(component.isOwner()).toBe(true);
    expect(component.collectionRoute()).toBe('/collection');
  });

  it('stops loading the shelf once the stats answer, even with none', () => {
    const component = setup().componentInstance;
    expect(component.shelfLoading()).toBe(false);
    expect(component.shelfStats()).toBeNull();
  });

  it('isOwner is false when the current user differs from the profile', () => {
    const fixture = setup('someone-else');
    expect(fixture.componentInstance.isOwner()).toBe(false);
    expect(fixture.componentInstance.collectionRoute()).toBe('/users/kowo');
  });

  it('editProfile navigates to settings for the owner only', () => {
    const owner = setup('user-1');
    owner.componentInstance.editProfile();
    expect(router.navigate).toHaveBeenCalledWith(['/settings'], {
      queryParams: { section: 'profile' },
    });

    router.navigate.mockClear();
    const viewer = setup('someone-else');
    viewer.componentInstance.editProfile();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('offers a guest the Fediverse follow for a local profile', () => {
    const fixture = setup(null, { isFollowedByCurrentUser: false });

    fixture.componentInstance.follow();

    const prompt = TestBed.inject(AuthPromptService);
    expect(prompt.isOpen()).toBe(true);
    expect(prompt.remoteFollow()).toBe('kowo');
    expect(followsService.follow).not.toHaveBeenCalled();
  });

  it('does not offer it for a profile that already lives on another server', () => {
    const fixture = setup(null, { username: 'marie@other.example' });

    fixture.componentInstance.follow();

    expect(TestBed.inject(AuthPromptService).remoteFollow()).toBeNull();
  });

  it('follow() follows and updates counts', () => {
    const fixture = setup('viewer', { isFollowedByCurrentUser: false });
    const component = fixture.componentInstance;

    component.follow();

    expect(followsService.follow).toHaveBeenCalledWith('user-1');
    expect(component.profile()?.isFollowedByCurrentUser).toBe(true);
    expect(component.stats()?.followersCount).toBe(4);
    expect(toastService.success).toHaveBeenCalled();
  });

  it('unfollow() unfollows and decrements the follower count', () => {
    const fixture = setup('viewer', { isFollowedByCurrentUser: true });
    const component = fixture.componentInstance;

    component.unfollow();

    expect(followsService.unfollow).toHaveBeenCalledWith('user-1');
    expect(component.profile()?.isFollowedByCurrentUser).toBe(false);
    expect(component.stats()?.followersCount).toBe(2);
  });

  describe('lists and versus', () => {
    it('loads the versus next to the lists and counts both', () => {
      const component = setup('user-1', {}, null, {
        lists: of({ content: [{ id: 'l1', createdAt: '2025-01-01T00:00:00Z' }], totalElements: 3 }),
        pools: of({ content: [{ id: 'v1', createdAt: '2025-02-01T00:00:00Z' }], totalElements: 2 }),
      }).componentInstance;
      expect(versusService.profilePools).toHaveBeenCalledWith('kowo');
      expect(component.creations().map((c) => `${c.kind}:${c.id}`)).toEqual([
        'versus:v1',
        'list:l1',
      ]);
      expect(component.creationsTotal()).toBe(5);
    });

    it('keeps reviews out of the rail, they have their own section', () => {
      const component = setup('user-1', {}, null, {
        reviews: of({ content: [{ id: 'r1', createdAt: '2025-02-01T00:00:00Z' }] }),
      }).componentInstance;
      expect(component.creations()).toEqual([]);
      expect(component.reviews().map((review) => review.id)).toEqual(['r1']);
    });

    it('survives a versus failure and still shows the lists', () => {
      const component = setup('user-1', {}, null, {
        lists: of({ content: [{ id: 'l1', createdAt: '2025-01-01T00:00:00Z' }], totalElements: 1 }),
        pools: throwError(() => new Error('boom')),
      }).componentInstance;
      expect(component.loadState()).toBe('ready');
      expect(component.pools()).toEqual([]);
      expect(component.creations().map((c) => c.id)).toEqual(['l1']);
    });
  });

  describe('unavailable profiles', () => {
    it('shows the private screen without a toast and looks the user up when signed in', () => {
      const component = setup(
        'viewer',
        {},
        new ApiError(403, 'private', 'PROFILE_PRIVATE'),
      ).componentInstance;

      expect(component.loadState()).toBe('private');
      expect(component.profile()).toBeNull();
      expect(toastService.error).not.toHaveBeenCalled();
      expect(friendsService.search).toHaveBeenCalledWith('kowo', 0, 5);
    });

    it('shows the not found screen without a toast', () => {
      const component = setup(
        'viewer',
        {},
        new ApiError(404, 'nope', 'USER_NOT_FOUND'),
      ).componentInstance;

      expect(component.loadState()).toBe('not_found');
      expect(toastService.error).not.toHaveBeenCalled();
      expect(friendsService.search).not.toHaveBeenCalled();
    });

    it('skips the lookup for guests', () => {
      setup(null, {}, new ApiError(403, 'private', 'PROFILE_PRIVATE'));

      expect(friendsService.search).not.toHaveBeenCalled();
    });

    it('falls back to a generic error screen for other failures', () => {
      const component = setup(
        'viewer',
        {},
        new ApiError(500, 'boom', 'INTERNAL_SERVER_ERROR'),
      ).componentInstance;

      expect(component.loadState()).toBe('error');
    });
  });

  it('opens the auth prompt when a guest follows or compares', () => {
    const component = setup(null, { isFollowedByCurrentUser: false }).componentInstance;
    const event = new Event('click');
    const prevent = vi.spyOn(event, 'preventDefault');

    component.compare(event);

    expect(prevent).toHaveBeenCalled();
  });

  describe('rendered page', () => {
    async function render(
      currentUserId: string | null,
      overrides: Partial<UserProfileResponse> = {},
      shelf: Record<string, unknown> | null = { total: 12, averageRating: 8.37 },
    ) {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideRouter([{ path: 'profile/:username', component: ProfilePageComponent }]),
          {
            provide: AuthService,
            useValue: { currentUser: () => (currentUserId ? { id: currentUserId } : null) },
          },
          {
            provide: UserProfileService,
            useValue: {
              getProfile: () => of(profile(overrides)),
              getActivity: () => of({ content: [] }),
              getReviews: () => of({ content: [] }),
              getEssentials: () => of([]),
            },
          },
          {
            provide: CollectionService,
            useValue: {
              statsForUser: () => of(shelf),
              list: () => of({ content: [], totalElements: 0 }),
              listForUser: () => of({ content: [], totalElements: 0 }),
              changes: new Subject(),
            },
          },
          {
            provide: ListsService,
            useValue: { forProfile: () => of({ content: [], totalElements: 0 }) },
          },
          {
            provide: VersusService,
            useValue: { profilePools: () => of({ content: [], totalElements: 0 }) },
          },
          { provide: PeopleService, useValue: {} },
          { provide: FollowsService, useValue: {} },
          { provide: EssentialsService, useValue: { replace: () => of([]) } },
          { provide: AmbientService, useValue: { follow: vi.fn().mockResolvedValue(undefined) } },
          { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
        ],
      });
      const harness = await RouterTestingHarness.create('/profile/kowo');
      harness.detectChanges();
      return harness;
    }

    const text = (el: Element) => el.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const block = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

    it('states the profile numbers in big, linked to where they live', async () => {
      const harness = await render('user-1');
      const el = harness.routeNativeElement as HTMLElement;
      const links = Array.from(
        el.querySelectorAll<HTMLAnchorElement>('nav[aria-label="profile.title"] a'),
      );
      const reviews = links.find((link) => block(link).includes('profile.stats.reviews'));
      const followers = links.find((link) => block(link).includes('profile.stats.followers'));

      expect(block(links[0])).toBe('12 profile.stats.titles');
      expect(block(links[1])).toBe('4.2 profile.stats.average_rating');
      expect(reviews?.getAttribute('href')).toBe('/profile/kowo/lists?f=reviews');
      expect(followers?.getAttribute('href')).toBe('/profile/kowo/connections?tab=followers');
    });

    it('leaves the average out until something is rated', async () => {
      const harness = await render('user-1', {}, { total: 0, averageRating: null });
      const el = harness.routeNativeElement as HTMLElement;
      const labels = Array.from(el.querySelectorAll('nav[aria-label="profile.title"] a')).map(
        (link) => block(link),
      );

      expect(labels[0]).toBe('0 profile.stats.titles');
      expect(labels.some((label) => label.includes('profile.stats.average_rating'))).toBe(false);
    });

    it('gives the owner five Essentials slots to fill', async () => {
      const harness = await render('user-1');
      const el = harness.routeNativeElement as HTMLElement;

      expect(el.querySelectorAll('shelfy-profile-essentials .v-essf-it')).toHaveLength(5);
      expect(text(el)).toContain('profile.essentials.owner_hint');
    });

    it('hides an empty Essentials from visitors and shows only the filled slots', async () => {
      const harness = await render('someone-else');
      const el = harness.routeNativeElement as HTMLElement;
      expect(el.querySelector('#essentials-title')).toBeNull();

      const page = harness.routeDebugElement?.componentInstance as ProfilePageComponent;
      page.essentials.set([
        {
          slot: 0,
          userMediaId: 'i1',
          media: {
            id: 'm1',
            mediaType: 'movie',
            externalId: '42',
            title: 'Dune',
            coverUrl: null,
            metadata: {},
            isAdult: false,
          } as EssentialEntry['media'],
        },
      ]);
      harness.detectChanges();

      expect(el.querySelectorAll('shelfy-profile-essentials .v-essf-it')).toHaveLength(1);
      expect(
        el.querySelector('shelfy-profile-essentials a[href="/media/movie/42"]'),
      ).not.toBeNull();
    });

    it('gives the owner only the edit button, without shelf, share, menu or compare', async () => {
      const harness = await render('user-1');
      const el = harness.routeNativeElement as HTMLElement;
      const content = text(el);

      expect(content).toContain('profile.edit');
      expect(content).not.toContain('profile.collection.cta');
      expect(content).not.toContain('profile.share');
      expect(content).not.toContain('profile.compare');
      expect(content).not.toContain('profile.follow');
      expect(el.querySelector('shelfy-menu-button')).toBeNull();
    });

    it('gives another user follow, shelf and compare buttons', async () => {
      const harness = await render('someone-else');
      const content = text(harness.routeNativeElement as HTMLElement);

      expect(content).toContain('profile.follow.action');
      expect(content).toContain('profile.collection.short');
      expect(content).toContain('profile.compare');
      expect(content).not.toContain('profile.edit');
      expect(content).not.toContain('profile.share');
    });

    it('shows the banner on the right only when one is set', async () => {
      const bare = await render('user-1');
      expect((bare.routeNativeElement as HTMLElement).querySelector('.v-p-banner')).toBeNull();

      const banner = await render('user-1', { profileBannerUrl: 'https://img/banner.jpg' });
      const el = banner.routeNativeElement as HTMLElement;
      expect(el.querySelector('.v-p-banner img')?.getAttribute('src')).toBe(
        'https://img/banner.jpg',
      );
    });
  });
});
