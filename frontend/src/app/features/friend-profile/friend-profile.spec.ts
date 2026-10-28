import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { BehaviorSubject, NEVER, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { UserProfileService } from '@app/core/services/users/user-profile';
import { CollectionService } from '@app/core/services/collection/collection';
import { LocalStorageService } from '@app/core/services/local-storage/local-storage';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { TranslateService } from '@app/core/services/translate/translate';
import { AuthService } from '@app/core/services/auth/auth';
import { AddSheetService } from '@app/core/services/add-sheet/add-sheet';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import type { UserProfileResponse } from '@app/core/services/people/people.model';

import { FriendProfilePageComponent } from './friend-profile';

const emptyPage = { content: [], page: 0, size: 24, totalElements: 0 };

function item(overrides: Partial<CollectionItemResponse> = {}): CollectionItemResponse {
  return {
    id: 'i1',
    userId: 'u1',
    media: {
      id: 'm1',
      canonicalWorkId: 'c1',
      externalId: 'e1',
      provider: 'tmdb',
      mediaType: 'movie',
      title: 'The Matrix',
      coverUrl: null,
      metadata: null,
      createdAt: '2024-01-01T00:00:00Z',
    },
    status: 'done',
    rating: 8,
    note: null,
    containsSpoilers: false,
    progress: {},
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function profile(overrides: Partial<UserProfileResponse> = {}): UserProfileResponse {
  return {
    id: 'u2',
    username: 'friend1',
    displayName: null,
    bio: null,
    avatarUrl: null,
    profileBannerUrl: null,
    profileBannerTitle: null,
    profileBannerProvider: null,
    profileBannerSourceUrl: null,
    profileBannerPosition: null,
    profileVisibility: 'public',
    isFollowedByCurrentUser: false,
    createdAt: '2024-01-01T00:00:00Z',
    stats: {
      totalItems: 0,
      doneCount: 0,
      averageRating: null,
      followersCount: 0,
      reviewsCount: 0,
    },
    ongoingItems: [],
    ...overrides,
  };
}

describe('FriendProfilePageComponent', () => {
  let userProfileService: {
    getProfile: ReturnType<typeof vi.fn>;
  };
  let collectionService: {
    listForUser: ReturnType<typeof vi.fn>;
    statsForUser: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    changes: typeof NEVER;
  };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let errorMessage: { fromApiError: ReturnType<typeof vi.fn> };
  let paramMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let queryParams: Record<string, string>;
  let stored: Record<string, string>;
  let auth: {
    isAuthenticated: ReturnType<typeof signal<boolean>>;
    currentUser: ReturnType<typeof signal<{ username: string } | null>>;
  };
  let addSheet: { open: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    queryParams = {};
    stored = {};
    auth = { isAuthenticated: signal(true), currentUser: signal({ username: 'me' }) };
    addSheet = { open: vi.fn() };
    paramMap = new BehaviorSubject(convertToParamMap({ username: 'friend1' }));
    userProfileService = {
      getProfile: vi.fn().mockReturnValue(of(profile())),
    };
    collectionService = {
      listForUser: vi.fn().mockReturnValue(of(emptyPage)),
      statsForUser: vi.fn().mockReturnValue(of(null)),
      remove: vi.fn().mockReturnValue(of(undefined)),
      create: vi.fn().mockReturnValue(of(item())),
      list: vi.fn().mockReturnValue(of(emptyPage)),
      changes: NEVER,
    };
    toastService = { success: vi.fn(), error: vi.fn() };
    errorMessage = { fromApiError: vi.fn().mockReturnValue('error') };

    await TestBed.configureTestingModule({
      imports: [FriendProfilePageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: AddSheetService, useValue: addSheet },
        { provide: UserProfileService, useValue: userProfileService },
        { provide: CollectionService, useValue: collectionService },
        {
          provide: LocalStorageService,
          useValue: {
            getItem: (key: string) => stored[key] ?? null,
            setItem: (key: string, value: string) => (stored[key] = value),
          },
        },
        { provide: ToastService, useValue: toastService },
        { provide: ErrorMessageService, useValue: errorMessage },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap,
            snapshot: { queryParamMap: { get: (key: string) => queryParams[key] ?? null } },
          },
        },
      ],
    }).compileComponents();
  });

  function createComponent(username = 'friend1') {
    paramMap.next(convertToParamMap({ username }));
    const fixture = TestBed.createComponent(FriendProfilePageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows every status by default, like my library', () => {
    const component = createComponent().componentInstance;

    expect(component.statusFilter()).toEqual([]);
    expect(component.activeStatusTab()).toBe('all');
  });

  it('opens on the backlog when linked with view=backlog', () => {
    queryParams = { view: 'backlog' };
    const component = createComponent().componentInstance;

    expect(component.statusFilter()).toEqual(['planned']);
  });

  it('titles the hero with the friend name', () => {
    userProfileService.getProfile.mockReturnValue(of(profile({ displayName: 'Margot' })));
    const component = createComponent().componentInstance;

    expect(component.friendName()).toBe('Margot');
    expect(component.heroTitle()).toBe('friends.shelf.title');
  });

  it('loads the profile for the routed username', () => {
    createComponent('friend1');

    expect(userProfileService.getProfile).toHaveBeenCalledWith('friend1');
  });

  it('exposes the resolved username from the route params', () => {
    const fixture = createComponent('friend1');
    expect(fixture.componentInstance.username()).toBe('friend1');
  });

  it('does not start with the common-only filter by default', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance.commonOnly()).toBe(false);
  });

  it('toggleCommonOnly flips the filter when not entered via collection compare', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component.toggleCommonOnly();
    expect(component.commonOnly()).toBe(true);

    component.toggleCommonOnly();
    expect(component.commonOnly()).toBe(false);
  });

  it('keeps the compare toggle in place when entered from a compare link', () => {
    queryParams = { compare: '1' };
    const component = createComponent().componentInstance;
    expect(component.commonOnly()).toBe(true);

    component.toggleCommonOnly();
    expect(component.commonOnly()).toBe(false);
  });

  it('ownItemFor() delegates to the state and reflects the fetched own items', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    const friendItem = item({ id: 'friend-item' });

    expect(component.ownItemFor(friendItem)).toBeNull();
  });

  it('does not carry the common-only filter over from a previous visit', () => {
    const first = createComponent('friend1').componentInstance;
    first.toggleCommonOnly();
    expect(createComponent('friend1').componentInstance.commonOnly()).toBe(false);
  });

  it('only compares when a signed-in viewer looks at someone else', () => {
    queryParams = { compare: '1' };
    expect(createComponent('friend1').componentInstance.comparing()).toBe(true);
    expect(createComponent('me').componentInstance.comparing()).toBe(false);
    auth.isAuthenticated.set(false);
    auth.currentUser.set(null);
    expect(createComponent('friend1').componentInstance.comparing()).toBe(false);
  });

  it('only sets my side of the comparison when comparing', () => {
    const component = createComponent().componentInstance;

    expect(component.versusItem(item())).toBeNull();
  });

  it('shows an error toast when the profile fails to load for a non-404 reason', () => {
    userProfileService.getProfile.mockReturnValue(throwError(() => ({ status: 500 })));
    createComponent();

    expect(toastService.error).toHaveBeenCalled();
  });
});
