import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { AuthService } from '@app/core/services/auth/auth';
import { UserProfileService } from '@app/core/services/users/user-profile';
import { VersusService } from '@app/core/services/versus/versus';
import { ListsService } from '@app/core/services/lists/lists';
import type { MediaListResponse } from '@app/core/services/lists/lists.model';
import { DiscoverService } from '@app/core/services/discover/discover';
import { TmdbService } from '@app/core/services/tmdb/tmdb';

import { ListsLibraryPageComponent } from './lists-library';

describe('ListsLibraryPageComponent', () => {
  let versusService: { profilePools: ReturnType<typeof vi.fn> };
  let listsService: { forProfile: ReturnType<typeof vi.fn> };
  let profiles: { getReviews: ReturnType<typeof vi.fn> };
  let host: HTMLElement;

  const pool = { id: 'v1', name: 'My pool', previewEntries: [], createdAt: '2030-01-01T00:00:00Z' };
  const review = {
    id: 'r1',
    media: { id: 'm1', title: 'Title', metadata: {} },
    username: 'lea',
    content: { type: 'doc', content: [] },
    createdAt: '2025-01-01T00:00:00Z',
  };

  function setup(
    routeUsername: string | null,
    currentUsername = 'kowo',
    pools: unknown = of({ content: [], totalElements: 0 }),
    reviews: unknown = of({ content: [], totalElements: 0 }),
    filter: string | null = null,
    kind: string | null = null,
  ) {
    profiles = { getReviews: vi.fn().mockReturnValue(reviews) };
    versusService = { profilePools: vi.fn().mockReturnValue(pools) };
    listsService = {
      forProfile: vi.fn().mockReturnValue(
        of({
          content: [
            { id: 'l1', name: 'My list', media: [], tags: [], createdAt: '2020-01-01T00:00:00Z' },
          ] as unknown as MediaListResponse[],
          totalElements: 1,
        }),
      ),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ListsLibraryPageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(
              convertToParamMap({
                ...(routeUsername ? { username: routeUsername } : {}),
                ...(kind ? { kind } : {}),
              }),
            ),
            queryParamMap: of(convertToParamMap(filter ? { f: filter } : {})),
          },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: () => ({ username: currentUsername }),
            isAuthenticated: () => true,
          },
        },
        { provide: ListsService, useValue: listsService },
        { provide: VersusService, useValue: versusService },
        { provide: UserProfileService, useValue: profiles },
        {
          provide: DiscoverService,
          useValue: {
            getMovies: () => of({ content: [], totalElements: 0 }),
            getSeries: () => of({ content: [], totalElements: 0 }),
          },
        },
        { provide: TmdbService, useValue: { imageUrl: () => null } },
      ],
    });

    const fixture = TestBed.createComponent(ListsLibraryPageComponent);
    fixture.detectChanges();
    host = fixture.nativeElement;
    return fixture.componentInstance;
  }

  it('falls back to the current user username when the route has none', () => {
    const component = setup(null);

    expect(component.profileUsername()).toBe('kowo');
    expect(listsService.forProfile).toHaveBeenCalledWith('kowo', '');
    expect(component.lists().map((l) => l.id)).toEqual(['l1']);
    expect(component.loading()).toBe(false);
  });

  it('loads lists for a profile username from the route', () => {
    setup('other-user');

    expect(listsService.forProfile).toHaveBeenCalledWith('other-user', '');
  });

  it('isOwner is true when the profile username matches the current user', () => {
    const component = setup(null, 'kowo');
    expect(component.isOwner()).toBe(true);
  });

  it('isOwner is false for another user profile', () => {
    const component = setup('other-user', 'kowo');
    expect(component.isOwner()).toBe(false);
  });

  describe('versus on the profile library', () => {
    beforeEach(() => {
      vi.stubGlobal(
        'ResizeObserver',
        class {
          observe(): void {}
          disconnect(): void {}
          unobserve(): void {}
        },
      );
    });
    afterEach(() => vi.unstubAllGlobals());

    it('loads the versus of the same user next to the lists', () => {
      const component = setup('other-user', 'kowo', of({ content: [pool], totalElements: 1 }));

      expect(versusService.profilePools).toHaveBeenCalledWith('other-user', 0, 50, '');
      expect(component.pools().map((p) => p.id)).toEqual(['v1']);
    });

    it('shows both kinds by default, newest first, and filters them', () => {
      const component = setup(null, 'kowo', of({ content: [pool], totalElements: 1 }));

      expect(component.creations().map((c) => `${c.kind}:${c.id}`)).toEqual([
        'versus:v1',
        'list:l1',
      ]);
      component.setFilter('lists');
      expect(component.creations().map((c) => c.kind)).toEqual(['list']);
      component.setFilter('versus');
      expect(component.creations().map((c) => c.kind)).toEqual(['versus']);
    });

    it('loads the reviews of the user and mixes them in with the rest', () => {
      const component = setup(
        'lea',
        'kowo',
        of({ content: [pool], totalElements: 1 }),
        of({ content: [review], totalElements: 1 }),
      );

      expect(profiles.getReviews).toHaveBeenCalledWith('lea', 0, 50, '');
      expect(component.creations().map((c) => c.kind)).toEqual(['versus', 'review', 'list']);
      expect(component.bandTitle()).toBe('profile.made.title');
      expect(component.heroStats()).toEqual([
        { key: 'review.list.title', count: 1 },
        { key: 'lists.filters.lists', count: 1 },
        { key: 'lists.filters.versus', count: 1 },
      ]);
      expect(component.total()).toBe(3);
    });

    it('shows a Reviews tab and preselects it with ?f=reviews', () => {
      const component = setup(
        'lea',
        'kowo',
        of({ content: [pool], totalElements: 1 }),
        of({ content: [review], totalElements: 1 }),
        'reviews',
      );

      expect(component.filterTabs().map((tab) => tab.id)).toEqual([
        'all',
        'reviews',
        'lists',
        'versus',
      ]);
      expect(component.filter()).toBe('reviews');
      expect(component.creations().map((c) => c.kind)).toEqual(['review']);
      expect(host.querySelector('shelfy-tabs')).not.toBeNull();
      expect(host.querySelectorAll('shelfy-review-card')).toHaveLength(1);
    });

    it('asks the server for every kind by name once the typing settles, keeping the tab counts', () => {
      vi.useFakeTimers();
      const component = setup(
        'lea',
        'kowo',
        of({ content: [pool], totalElements: 1 }),
        of({ content: [review], totalElements: 1 }),
      );
      const empty = of({ content: [], totalElements: 0 });
      listsService.forProfile.mockReturnValue(empty);
      versusService.profilePools.mockReturnValue(empty);
      profiles.getReviews.mockReturnValue(empty);

      component.query.set(' Pixar ');
      TestBed.tick();
      vi.advanceTimersByTime(250);
      TestBed.inject(ApplicationRef).tick();
      vi.useRealTimers();

      expect(listsService.forProfile).toHaveBeenLastCalledWith('lea', 'Pixar');
      expect(versusService.profilePools).toHaveBeenLastCalledWith('lea', 0, 50, 'Pixar');
      expect(profiles.getReviews).toHaveBeenLastCalledWith('lea', 0, 50, 'Pixar');
      expect(component.creations()).toEqual([]);
      expect(component.filterTabs().map((tab) => tab.count)).toEqual([3, 1, 1, 1]);
      expect(host.textContent).toContain('lists.search_empty');
      expect(host.querySelector('input[type="search"]')).not.toBeNull();
    });

    it('opens the own versus from /me/versus', () => {
      const component = setup(
        null,
        'kowo',
        of({ content: [pool], totalElements: 1 }),
        of({ content: [review], totalElements: 1 }),
        null,
        'versus',
      );

      expect(component.isOwner()).toBe(true);
      expect(versusService.profilePools).toHaveBeenCalledWith('kowo', 0, 50, '');
      expect(component.filter()).toBe('versus');
      expect(component.creations().map((c) => c.kind)).toEqual(['versus']);
    });

    it('shows the tabs for reviews next to lists without versus, grouped by kind', () => {
      setup(
        'lea',
        'kowo',
        of({ content: [], totalElements: 0 }),
        of({ content: [review], totalElements: 1 }),
      );

      expect(host.querySelector('shelfy-tabs')).not.toBeNull();
      expect([...host.querySelectorAll('section h2')].map((h) => h.textContent?.trim())).toEqual([
        expect.stringContaining('profile.creations.title'),
        expect.stringContaining('review.list.title'),
      ]);
    });

    it('falls back to all when the requested kind has nothing', () => {
      const component = setup(
        null,
        'kowo',
        of({ content: [pool], totalElements: 1 }),
        undefined,
        'reviews',
      );

      expect(component.filter()).toBe('all');
      expect(component.creations()).toHaveLength(2);
    });

    it('keeps the lists when the reviews call fails', () => {
      const component = setup(
        null,
        'kowo',
        of({ content: [], totalElements: 0 }),
        throwError(() => new Error('boom')),
      );

      expect(component.profileFailed()).toBe(false);
      expect(component.reviews()).toEqual([]);
    });

    it('keeps the lists when the versus call fails, without a filter bar', () => {
      const component = setup(
        null,
        'kowo',
        throwError(() => new Error('boom')),
      );

      expect(component.profileFailed()).toBe(false);
      expect(component.pools()).toEqual([]);
      expect(component.creations().map((c) => c.id)).toEqual(['l1']);
    });

    it('offers one Create menu to the owner and no Mine/Community tabs', () => {
      setup(null, 'kowo', of({ content: [pool], totalElements: 1 }));

      expect(host.querySelectorAll('shelfy-menu-button')).toHaveLength(1);
      expect(host.querySelector('shelfy-tabs[variant="chips"]')).toBeNull();
      expect(host.querySelector('shelfy-page-hero')).not.toBeNull();
      expect(host.querySelector('input[type="search"]')).not.toBeNull();
    });

    it('shows no Create menu nor filter tabs on someone else with one kind, only the search', () => {
      setup('lea', 'kowo');

      expect(host.querySelector('shelfy-menu-button')).toBeNull();
      expect(host.querySelector('shelfy-tabs')).toBeNull();
      expect(host.querySelector('input[type="search"]')).not.toBeNull();
    });

    it('points the back link at the own profile for the owner and at the profile otherwise', () => {
      expect(setup(null, 'kowo').profileLink()).toBe('/profile');
      expect(setup('lea', 'kowo').profileLink()).toEqual(['/profile', 'lea']);
    });
  });
});
