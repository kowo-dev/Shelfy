import { vi } from 'vitest';

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, Subject, type Observable } from 'rxjs';
import { AuthService } from '@app/core/services/auth/auth';
import { FeedService } from '@app/core/services/community/community';
import { DiscoverService } from '@app/core/services/discover/discover';
import { LocalStorageService } from '@app/core/services/local-storage/local-storage';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { FollowsService } from '@app/core/services/follows/follows';
import { PeopleService } from '@app/core/services/people/people';
import { ListsService } from '@app/core/services/lists/lists';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { UserProfileService } from '@app/core/services/users/user-profile';
import { VersusService } from '@app/core/services/versus/versus';
import { CommunityPageComponent } from './community';

const page = <T>(content: T[]) => of({ content, totalElements: content.length });
const media = (cover: string | null) => ({ title: 'Title', coverUrl: cover, isAdult: false });
const list = (id: string, covers: (string | null)[] = []) => ({
  id,
  name: id,
  previewMedia: covers.map(media),
  itemCount: covers.length,
  updatedAt: '2026-03-01T00:00:00Z',
});

describe('CommunityPageComponent', () => {
  function setup(
    params: Record<string, string> = {},
    signedIn = true,
    listsPage: ReturnType<typeof list>[] = [list('a')],
    reviewsPage: Observable<{ content: unknown[]; totalElements: number }> = page([]),
  ) {
    const query = new BehaviorSubject(convertToParamMap(params));
    const feed = {
      page: vi.fn().mockReturnValue(of({ items: [], nextBefore: null })),
      unread: vi.fn().mockReturnValue(of({ count: 0 })),
    };
    const lists = { browse: vi.fn().mockReturnValue(page(listsPage)) };
    const discover = {
      getMovies: vi.fn().mockReturnValue(page([{ posterPath: '/movie.jpg' }])),
      getSeries: vi.fn().mockReturnValue(page([{ posterPath: '/series.jpg' }])),
    };
    const stored: Record<string, string> = {};
    const storage = {
      getItem: (key: string) => stored[key] ?? null,
      setItem: vi.fn((key: string, value: string) => (stored[key] = value)),
    };
    const versus = { browsePools: vi.fn().mockReturnValue(page([])) };
    const profiles = { browseReviews: vi.fn().mockReturnValue(reviewsPage) };
    const friends = { search: vi.fn().mockReturnValue(page([])) };
    const follows = {
      following: vi.fn().mockReturnValue(page([])),
      followers: vi.fn().mockReturnValue(page([])),
    };
    const router = { navigate: vi.fn() };
    TestBed.configureTestingModule({
      imports: [CommunityPageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: query, snapshot: { queryParamMap: query.value } },
        },
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: { isAuthenticated: signal(signedIn) } },
        { provide: FeedService, useValue: feed },
        { provide: ListsService, useValue: lists },
        { provide: VersusService, useValue: versus },
        { provide: UserProfileService, useValue: profiles },
        { provide: PeopleService, useValue: friends },
        { provide: FollowsService, useValue: follows },
        { provide: DiscoverService, useValue: discover },
        { provide: TmdbService, useValue: { imageUrl: (path: string) => `tmdb${path}` } },
        { provide: LocalStorageService, useValue: storage },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: ErrorMessageService, useValue: { fromApiError: () => 'error' } },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    TestBed.overrideComponent(CommunityPageComponent, { set: { template: '' } });
    const fixture = TestBed.createComponent(CommunityPageComponent);
    fixture.detectChanges();
    return {
      component: fixture.componentInstance,
      feed,
      lists,
      versus,
      profiles,
      friends,
      follows,
      router,
      storage,
    };
  }

  const browsedWith = (mock: ReturnType<typeof vi.fn>, size: number) =>
    mock.mock.calls.filter(([, pageSize]) => pageSize === size).map(([, , query]) => query);

  it('opens on the landing rails, without browsing the grid', () => {
    const { component, lists, versus, profiles } = setup();

    expect(component.landing()).toBe(true);
    expect(browsedWith(profiles.browseReviews, 24)).toEqual([]);
    expect(browsedWith(lists.browse, 24)).toEqual([]);
    expect(browsedWith(profiles.browseReviews, 12)).toEqual(
      expect.arrayContaining([
        { scope: 'ALL', sort: 'POPULAR' },
        { scope: 'CIRCLE', sort: 'RECENT' },
      ]),
    );
    expect(browsedWith(lists.browse, 12)).toEqual([
      { scope: 'MINE', sort: 'RECENT' },
      { scope: 'ALL', sort: 'POPULAR' },
    ]);
    expect(browsedWith(versus.browsePools, 12)).toEqual([
      { scope: 'MINE', sort: 'RECENT' },
      { scope: 'ALL', sort: 'POPULAR' },
    ]);
  });

  it('keeps the friends and fediverse rails away from a visitor', () => {
    const { profiles } = setup({}, false);

    expect(browsedWith(profiles.browseReviews, 12)).toEqual([{ scope: 'ALL', sort: 'POPULAR' }]);
  });

  it('browses the grid as soon as the URL names a view', () => {
    const { component, lists, profiles } = setup({ f: 'lists' });

    expect(component.landing()).toBe(false);
    expect(browsedWith(lists.browse, 12)).toEqual([]);
    expect(browsedWith(profiles.browseReviews, 12)).toEqual([]);
    expect(browsedWith(lists.browse, 24)).toHaveLength(1);
  });

  it('opens the Reviews grid from everyone when asked', () => {
    const { component, feed, profiles } = setup({ f: 'reviews' });

    expect(component.view()).toBe('reviews');
    expect(component.scope()).toBe('ALL');
    expect(feed.page).not.toHaveBeenCalled();
    expect(browsedWith(profiles.browseReviews, 24)).toEqual([
      expect.objectContaining({ scope: 'ALL', sort: 'RECENT' }),
    ]);
  });

  it('keeps a visitor on Everyone whatever the URL asks for', () => {
    const { component, lists } = setup({ f: 'lists', scope: 'MINE' }, false);

    expect(component.scope()).toBe('ALL');
    expect(browsedWith(lists.browse, 24)).toEqual([expect.objectContaining({ scope: 'ALL' })]);
  });

  it('counts the circle and its news of the day under the title', () => {
    const { follows, feed } = setup();

    expect(follows.following).toHaveBeenCalledWith(0, 1);
    expect(feed.unread).toHaveBeenCalled();
  });

  it('counts nothing for a visitor', () => {
    const { follows, feed } = setup({}, false);

    expect(follows.following).not.toHaveBeenCalled();
    expect(feed.unread).not.toHaveBeenCalled();
  });

  it('shows the account its own lists under the Mine scope, with their visibility', () => {
    const { component, lists } = setup({ f: 'lists', scope: 'MINE' });

    expect(browsedWith(lists.browse, 24)).toEqual([expect.objectContaining({ scope: 'MINE' })]);
    expect(component.showVisibility()).toBe(true);
  });

  it('browses a single kind on its tab, with the sort and the scope from the URL', () => {
    const { lists, versus } = setup({ f: 'lists', scope: 'CIRCLE', sort: 'POPULAR' });

    expect(browsedWith(versus.browsePools, 24)).toEqual([]);
    expect(browsedWith(lists.browse, 24)).toEqual([
      expect.objectContaining({ scope: 'CIRCLE', sort: 'POPULAR' }),
    ]);
  });

  it('filters the current tab with the search query', () => {
    const { versus, friends } = setup({ f: 'versus', q: 'ghibli' });

    expect(browsedWith(versus.browsePools, 24)).toEqual([expect.objectContaining({ q: 'ghibli' })]);
    expect(friends.search).not.toHaveBeenCalled();
  });

  it('carries the scope between tabs and always names the view', () => {
    const { component, router } = setup({ f: 'lists', scope: 'CIRCLE' });
    component.selectView('versus');
    component.selectView('reviews');
    component.selectView('feed');

    const sent = router.navigate.mock.calls.map(([, extras]) => extras.queryParams);
    expect(sent).toEqual([
      { f: 'versus', scope: 'CIRCLE', sort: null },
      { f: 'reviews', scope: 'CIRCLE', sort: null },
    ]);
  });

  it('goes back to the landing rows from the Overview tab', () => {
    const { component, router } = setup({ f: 'lists', scope: 'CIRCLE', q: 'ghibli' });
    component.selectView('overview');

    const [, extras] = router.navigate.mock.calls[0];
    expect(extras.queryParams).toEqual({ f: null, scope: null, sort: null, q: null });
  });

  it('leaves Everyone implicit in the URL', () => {
    const { component, router } = setup({ f: 'reviews' });
    component.setScope('CIRCLE');
    component.setScope('ALL');

    const sent = router.navigate.mock.calls.map(([, extras]) => extras.queryParams);
    expect(sent).toEqual([
      { f: 'reviews', scope: 'CIRCLE' },
      { f: 'reviews', scope: null },
    ]);
  });

  it('writes the sort only when it is not the default', () => {
    const { component, router } = setup({ f: 'lists' });
    component.setSort('POPULAR');
    component.setSort('RECENT');

    const sent = router.navigate.mock.calls.map(([, extras]) => extras.queryParams);
    expect(sent).toEqual([
      { f: 'lists', sort: 'POPULAR' },
      { f: 'lists', sort: null },
    ]);
  });

  it('opens the studio for a list or a versus, the picker for a review', () => {
    const { component, router } = setup();
    component.onCreate('list');
    expect(router.navigate).toHaveBeenCalledWith(['/lists/new']);
    component.onCreate('versus');
    expect(router.navigate).toHaveBeenCalledWith(['/versus/new']);

    component.onCreate('review');
    expect(component.pickerOpen()).toBe(true);
  });

  it('opens the review studio for one title even when the picker emits several', async () => {
    const { component, router } = setup();
    const result = (externalId: string) =>
      ({ provider: 'tmdb', mediaType: 'movie', externalId, title: externalId }) as never;

    component.startReview(result('1'));
    component.startReview(result('2'));

    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/reviews/new'], {
      queryParams: { provider: 'tmdb', mediaType: 'movie', externalId: '1', title: '1' },
    });
    await Promise.resolve();
    component.startReview(result('3'));
    expect(router.navigate).toHaveBeenCalledTimes(2);
  });

  it('only lights the landing rows with creations that have their artwork', () => {
    const { component } = setup({}, true, [
      list('lit', ['a.jpg', 'b.jpg']),
      list('blank', [null]),
      list('empty'),
    ]);

    const rail = component.landingState.rails().find((row) => row.id === 'popular-lists');
    expect(rail?.items.map((item) => item.id)).toEqual(['list-lit']);
  });

  it('shows the landing rows in order, so a slow row never lands above the others', () => {
    const reviews = new Subject<{ content: unknown[]; totalElements: number }>();
    const { component } = setup({}, true, [list('lit', ['a.jpg', 'b.jpg'])], reviews);

    const ids = () => component.landingState.rails().map((rail) => rail.id);
    expect(ids()).toEqual(['mine']);

    reviews.next({ content: [], totalElements: 0 });
    reviews.complete();

    expect(ids()).toEqual(['mine', 'popular-lists']);
  });
});
