import { vi } from 'vitest';

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { AuthService } from '@app/core/services/auth/auth';
import { DiscoverService } from '@app/core/services/discover/discover';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { FollowsService } from '@app/core/services/follows/follows';
import { PeopleService } from '@app/core/services/people/people';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { UserProfileService } from '@app/core/services/users/user-profile';

import { ProfileConnectionsPageComponent } from './profile-connections';

const user = (id: string, coverUrls: string[] = []) => ({
  id,
  username: `user${id}`,
  displayName: null,
  avatarUrl: null,
  coverUrls,
});
const page = <T>(content: T[]) => of({ content, totalElements: content.length });
const trending = (count: number) =>
  of({
    content: Array.from({ length: count }, (_, index) => ({ posterPath: `/t${index}.jpg` })),
  });

describe('ProfileConnectionsPageComponent', () => {
  beforeEach(() => localStorage.clear());

  function setup(
    me: string,
    tab: string | null = null,
    { username = 'kowo' as string | null, trendingCount = 0 } = {},
  ) {
    const query = new BehaviorSubject(convertToParamMap(tab ? { tab } : {}));
    const follows = {
      followers: vi.fn().mockReturnValue(page([user('a', ['a1.jpg']), user('b', ['b1.jpg'])])),
      following: vi.fn().mockReturnValue(page([user('b')])),
      favorites: vi.fn().mockReturnValue(page([])),
      favorite: vi.fn().mockReturnValue(of(undefined)),
      unfavorite: vi.fn().mockReturnValue(of(undefined)),
      popular: vi.fn().mockReturnValue(page([{ ...user('p'), followersCount: 40 }])),
      followersOf: vi.fn().mockReturnValue(page([user('a'), user('c')])),
      followingOf: vi.fn().mockReturnValue(page([user('b')])),
      follow: vi.fn().mockReturnValue(of(undefined)),
      unfollow: vi.fn().mockReturnValue(of(undefined)),
    };
    const router = { navigate: vi.fn() };
    const toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [ProfileConnectionsPageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap(username ? { username } : {})),
            queryParamMap: query,
          },
        },
        { provide: Router, useValue: router },
        {
          provide: AuthService,
          useValue: {
            currentUser: () => ({ id: me, username: me === 'owner' ? 'kowo' : me }),
          },
        },
        {
          provide: UserProfileService,
          useValue: {
            getProfile: () =>
              of({
                id: 'owner',
                username: 'kowo',
                displayName: 'Kowo',
                stats: { followersCount: 7 },
              }),
          },
        },
        {
          provide: DiscoverService,
          useValue: {
            getMovies: () => trending(trendingCount),
            getSeries: () => trending(trendingCount),
          },
        },
        { provide: TmdbService, useValue: { imageUrl: (path: string) => `img${path}` } },
        { provide: FollowsService, useValue: follows },
        { provide: PeopleService, useValue: { search: vi.fn().mockReturnValue(page([])) } },
        { provide: ToastService, useValue: toast },
        { provide: ErrorMessageService, useValue: { fromApiError: () => 'error' } },
        {
          provide: TranslateService,
          useValue: {
            get: (key: string, params?: { name?: string }) =>
              params?.name ? `${key}:${params.name}` : key,
            lang: () => 'en',
          },
        },
      ],
    });
    TestBed.overrideComponent(ProfileConnectionsPageComponent, { set: { template: '' } });
    const fixture = TestBed.createComponent(ProfileConnectionsPageComponent);
    fixture.detectChanges();
    return { component: fixture.componentInstance, follows, router, toast };
  }

  it('opens on the activity of the people the owner follows', () => {
    const { component, follows } = setup('owner');

    expect(component.tab()).toBe('activity');
    expect(follows.following).toHaveBeenCalled();
  });

  it('stars someone the viewer follows and rolls back when it fails', () => {
    const { component, follows } = setup('owner', 'followers');
    const [stranger, friend] = component.people();

    expect(component.canFavorite(stranger)).toBe(false);
    expect(component.canFavorite(friend)).toBe(true);

    component.toggleFavorite(friend);
    expect(follows.favorite).toHaveBeenCalledWith('b');
    expect(component.isFavorite(friend)).toBe(true);

    follows.unfavorite.mockReturnValue(throwError(() => ({ status: 500 })));
    component.toggleFavorite(friend);
    expect(component.isFavorite(friend)).toBe(true);
  });

  it('forgets a favorite on unfollow', () => {
    const { component, follows } = setup('owner', 'following');
    follows.following.mockReturnValue(page([{ ...user('b'), isFavorite: true }]));
    const [friend] = component.people();
    component.toggleFavorite(friend);

    component.act(friend, { labelKey: 'x', primary: false, kind: 'unfollow' });

    expect(component.isFavorite(friend)).toBe(false);
  });

  it('gives the owner the activity tab then four tabs with counts and offers follow back', () => {
    const { component } = setup('owner', 'followers');

    expect(component.tabs().map((tab) => [tab.id, tab.count])).toEqual([
      ['activity', null],
      ['following', 1],
      ['followers', 2],
      ['favorites', 0],
      ['discover', null],
    ]);
    expect(
      component
        .people()
        .map((person) => [person.username, person.action?.labelKey ?? person.noteKey]),
    ).toEqual([
      ['usera', 'community.people.follow_back'],
      ['userb', 'community.people.mutual'],
    ]);
  });

  it('shows a visitor the followers of that profile, read only except follow', () => {
    const { component, follows } = setup('me');

    expect(component.tabIds()).toEqual(['followers', 'following']);
    expect(follows.followersOf).toHaveBeenCalledWith('owner', 0, 30);
    expect(
      component
        .people()
        .map((person) => [person.username, person.action?.labelKey ?? person.noteKey]),
    ).toEqual([
      ['usera', 'profile.follow.action'],
      ['userc', 'profile.follow.action'],
    ]);
  });

  it('keeps the tab in the url', () => {
    const { component, router } = setup('owner');
    component.selectTab('following');

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { tab: 'following' }, replaceUrl: true }),
    );
  });

  it('suggests popular accounts to follow', () => {
    const { component } = setup('owner', 'discover');
    const [person] = component.people();

    expect(person.followersCount).toBe(40);
    expect(person.action?.kind).toBe('follow');
  });

  it('drops a suggestion once followed', () => {
    const { component, follows } = setup('owner', 'discover');
    const [person] = component.people();
    component.act(person, person.action!);

    expect(follows.follow).toHaveBeenCalledWith('p');
    expect(component.people()).toEqual([]);
  });

  it('offers to follow a search result unless I already follow them or it is me', () => {
    const { component } = setup('owner');
    const result = (id: string, isFollowedByCurrentUser: boolean) => ({
      ...user(id),
      profileVisibility: 'public' as const,
      isFollowedByCurrentUser,
      bannerUrl: null,
      titleCount: null,
      coverUrls: [],
    });
    component.results.set([result('x', false), result('y', true), result('owner', false)]);

    expect(
      component
        .resultViews()
        .map((person) => [person.userId, person.action?.kind ?? person.noteKey]),
    ).toEqual([
      ['x', 'follow'],
      ['y', 'community.people.you_follow'],
      ['owner', null],
    ]);
  });

  it('unfollows someone from the following tab', () => {
    const { component, follows } = setup('owner', 'following');
    const [person] = component.people();

    component.act(person, { labelKey: 'x', primary: false, kind: 'unfollow' });

    expect(follows.unfollow).toHaveBeenCalledWith('b');
    expect(component.people()).toEqual([]);
  });

  it('reports a failed action and frees the person for another try', () => {
    const { component, follows, toast } = setup('owner', 'discover');
    follows.follow.mockReturnValue(throwError(() => new Error('boom')));
    const [person] = component.people();

    component.act(person, person.action!);

    expect(toast.error).toHaveBeenCalledWith('error');
    expect(component.people()).toHaveLength(1);
  });

  it('titles the page by whose connections they are', () => {
    const own = setup('owner', null, { username: null });

    expect(own.component.heroTitle()).toBe('nav.people');

    TestBed.resetTestingModule();
    const visitor = setup('me');

    expect(visitor.component.heroTitle()).toBe('connections.title_of:Kowo');
  });

  it('counts following and followers in the hero', () => {
    const { component } = setup('owner');

    expect(component.heroStats()).toEqual({ following: 1, followers: 2 });
  });

  it('tells a visitor about the profile rather than about themselves when a list is empty', () => {
    const { component } = setup('me', 'following');

    expect(component.empty().title).toBe('connections.empty.following_title');
    expect(component.empty().body).toBe('connections.empty.following_theirs');

    TestBed.resetTestingModule();
    const owner = setup('owner', 'following');

    expect(owner.component.empty().body).toBe('friends.following.empty');
  });

  it('leaves the search when another list is picked', () => {
    const { component, router } = setup('owner');
    component.onQuery('ma');

    component.selectTab('followers');

    expect(component.query()).toBe('');
    expect(router.navigate).toHaveBeenCalled();
  });
});
