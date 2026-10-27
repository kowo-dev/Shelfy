import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { CollectionService } from '@app/core/services/collection/collection';
import { vi } from 'vitest';

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { ListsService } from '@app/core/services/lists/lists';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import { ShelfLookupService } from '@app/core/services/shelf-lookup/shelf-lookup';
import { AuthService } from '@app/core/services/auth/auth';
import { FollowsService } from '@app/core/services/follows/follows';
import { SearchService } from '@app/core/services/search/search';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { TranslateService } from '@app/core/services/translate/translate';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import type { MediaListResponse } from '@app/core/services/lists/lists.model';

import { ListDetailPageComponent } from './list-detail';

function list(overrides: Partial<MediaListResponse> = {}): MediaListResponse {
  return {
    id: 'list-1',
    userId: 'owner-1',
    name: 'My list',
    description: 'desc',
    visibility: 'public',
    tags: [],
    media: [],
    items: [],
    collaborators: [],
    pendingInvites: [],
    viewerCollaboratorStatus: null,
    canEditItems: false,
    isLikedByViewer: false,
    completion: { percentage: 0, completed: 0, total: 0, done: 0, ongoing: 0 },
    comments: [],
    commentCount: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  } as unknown as MediaListResponse;
}

describe('ListDetailPageComponent', () => {
  let listsService: {
    get: ReturnType<typeof vi.fn>;
    like: ReturnType<typeof vi.fn>;
    unlike: ReturnType<typeof vi.fn>;
    inviteCollaborator: ReturnType<typeof vi.fn>;
    acceptCollaboratorInvite: ReturnType<typeof vi.fn>;
    declineCollaboratorInvite: ReturnType<typeof vi.fn>;
    removeCollaborator: ReturnType<typeof vi.fn>;
    addItems: ReturnType<typeof vi.fn>;
    removeItems: ReturnType<typeof vi.fn>;
    reorder: ReturnType<typeof vi.fn>;
    updateDetails: ReturnType<typeof vi.fn>;
    comments: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let followsService: { followers: ReturnType<typeof vi.fn> };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let router: {
    navigate: ReturnType<typeof vi.fn>;
    navigateByUrl: ReturnType<typeof vi.fn>;
    currentNavigation: () => unknown;
  };
  let confirm: { ask: ReturnType<typeof vi.fn> };
  let current: ComponentFixture<ListDetailPageComponent>;
  let paramMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  function setup(
    currentUserId = 'owner-1',
    overrides: Partial<MediaListResponse> = {},
    navigationState: Record<string, unknown> = {},
  ) {
    paramMap = new BehaviorSubject(convertToParamMap({ id: 'list-1' }));
    listsService = {
      get: vi.fn().mockReturnValue(of(list(overrides))),
      like: vi.fn().mockReturnValue(of(undefined)),
      unlike: vi.fn().mockReturnValue(of(undefined)),
      inviteCollaborator: vi.fn().mockReturnValue(of(undefined)),
      acceptCollaboratorInvite: vi.fn().mockReturnValue(of(undefined)),
      declineCollaboratorInvite: vi.fn().mockReturnValue(of(undefined)),
      removeCollaborator: vi.fn().mockReturnValue(of(undefined)),
      addItems: vi.fn().mockReturnValue(of(list(overrides))),
      removeItems: vi.fn().mockReturnValue(of(list(overrides))),
      reorder: vi.fn().mockReturnValue(of(list(overrides))),
      updateDetails: vi.fn().mockReturnValue(of(list(overrides))),
      comments: vi.fn().mockReturnValue(of({ content: [], totalElements: 0, page: 0, size: 20 })),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };
    followsService = { followers: vi.fn().mockReturnValue(of({ content: [] })) };
    toastService = { success: vi.fn(), error: vi.fn() };
    router = {
      navigate: vi.fn(),
      navigateByUrl: vi.fn(),
      currentNavigation: () => ({ extras: { state: navigationState } }),
    };
    confirm = { ask: vi.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      imports: [ListDetailPageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap,
            queryParamMap: of(convertToParamMap({})),
            snapshot: { paramMap: paramMap.value, queryParamMap: convertToParamMap({}) },
          },
        },
        { provide: Router, useValue: router },
        { provide: ListsService, useValue: listsService },
        {
          provide: AuthService,
          useValue: { currentUser: () => ({ id: currentUserId }), isAuthenticated: () => true },
        },
        { provide: FollowsService, useValue: followsService },
        {
          provide: SearchService,
          useValue: { search: vi.fn().mockReturnValue(of({ results: [] })) },
        },
        { provide: TmdbService, useValue: { imageUrl: () => 'tmdb-url' } },
        { provide: IgdbService, useValue: { imageUrl: () => 'igdb-url' } },
        { provide: ToastService, useValue: toastService },
        { provide: ErrorMessageService, useValue: { fromApiError: () => 'error' } },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
        {
          provide: DateFormatService,
          useValue: {
            formatDate: () => 'Jan 1, 2024',
            formatDateTime: () => 'formatted',
            formatRelative: () => '2 days ago',
          },
        },
        { provide: ShelfLookupService, useValue: { find: () => null, request: vi.fn() } },
        {
          provide: CollectionService,
          useValue: { lookupBatch: () => of({}), changes: new Subject() },
        },
        { provide: ConfirmService, useValue: confirm },
      ],
    });

    const fixture = TestBed.createComponent(ListDetailPageComponent);
    fixture.detectChanges();
    current = fixture;
    return fixture;
  }

  function fixtureHost(): HTMLElement {
    return current.nativeElement;
  }

  function buttonByText(text: string): HTMLButtonElement | undefined {
    return Array.from(fixtureHost().querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === text,
    );
  }

  it('loads the list and derives isOwner', () => {
    const fixture = setup('owner-1');
    const component = fixture.componentInstance;

    expect(listsService.get).toHaveBeenCalledWith('list-1');
    expect(component.list()?.id).toBe('list-1');
    expect(component.isOwner()).toBe(true);
  });

  it('is not owner for a different current user', () => {
    const fixture = setup('someone-else');
    expect(fixture.componentInstance.isOwner()).toBe(false);
  });

  it('toggleLike flips the heart at once and keeps it when the request succeeds', () => {
    const fixture = setup('other-user', { isLikedByViewer: false, likeCount: 2 });
    const component = fixture.componentInstance;

    component.toggleLike();

    expect(listsService.like).toHaveBeenCalledWith('list-1');
    expect(component.list()?.isLikedByViewer).toBe(true);
    expect(component.list()?.likeCount).toBe(3);
    expect(listsService.get).toHaveBeenCalledTimes(1);
  });

  it('toggleLike rolls back and toasts when the request fails', () => {
    const fixture = setup('other-user', { isLikedByViewer: false, likeCount: 2 });
    const component = fixture.componentInstance;
    listsService.like.mockReturnValue(throwError(() => new Error('boom')));

    component.toggleLike();

    expect(component.list()?.isLikedByViewer).toBe(false);
    expect(component.list()?.likeCount).toBe(2);
    expect(component.liking()).toBe(false);
  });

  it('toggleLike does nothing for the owner', () => {
    const fixture = setup('owner-1');
    const component = fixture.componentInstance;

    component.toggleLike();

    expect(listsService.like).not.toHaveBeenCalled();
    expect(listsService.unlike).not.toHaveBeenCalled();
  });

  it('showing the collaborators opens the sheet and loads followers for the owner', () => {
    const fixture = setup();
    const component = fixture.componentInstance;

    component.collab.show();

    expect(component.collab.open()).toBe(true);
    expect(followsService.followers).toHaveBeenCalled();
  });

  it('inviting invites a follower and shows a success toast', () => {
    const fixture = setup();
    const component = fixture.componentInstance;

    component.collab.invite({ id: 'follower-1' } as never);

    expect(listsService.inviteCollaborator).toHaveBeenCalledWith('list-1', 'follower-1');
    expect(toastService.success).toHaveBeenCalled();
  });

  it('accepting and declining call the service and refresh/navigate', () => {
    const fixture = setup();
    const component = fixture.componentInstance;

    component.collab.accept();
    expect(listsService.acceptCollaboratorInvite).toHaveBeenCalledWith('list-1');

    component.collab.decline();
    expect(listsService.declineCollaboratorInvite).toHaveBeenCalledWith('list-1');
    expect(router.navigate).toHaveBeenCalled();
  });

  it('leaving removes the current user as collaborator and navigates away', () => {
    const fixture = setup('owner-1');
    const component = fixture.componentInstance;

    component.collab.leave();

    expect(listsService.removeCollaborator).toHaveBeenCalledWith('list-1', 'owner-1');
    expect(router.navigate).toHaveBeenCalled();
  });

  const titles = [
    { id: 'm1', provider: 'tmdb', mediaType: 'movie', externalId: '1', title: 'One' },
    { id: 'm2', provider: 'tmdb', mediaType: 'movie', externalId: '2', title: 'Two' },
    { id: 'm3', provider: 'tmdb', mediaType: 'movie', externalId: '3', title: 'Three' },
  ] as never;

  it('adds picked titles in one request, credited by the server', () => {
    const component = setup('owner-1', { canEditItems: true }).componentInstance;

    component.edit.add([{ provider: 'tmdb', mediaType: 'movie', externalId: '1' } as never]);

    expect(listsService.addItems).toHaveBeenCalledWith('list-1', [
      { provider: 'tmdb', mediaType: 'movie', externalId: '1' },
    ]);
  });

  it('hides a removed title at once and only sends the removal after the undo window', async () => {
    vi.useFakeTimers();
    try {
      const component = setup('owner-1', { canEditItems: true, media: titles }).componentInstance;

      await component.edit.remove(['m2']);

      expect(component.edit.media().map((m) => m.id)).toEqual(['m1', 'm3']);
      expect(listsService.removeItems).not.toHaveBeenCalled();
      const [, duration, action] = toastService.success.mock.calls[0];
      expect(duration).toBe(5000);
      expect(action.label).toBe('lists.manage.undo');

      vi.advanceTimersByTime(5000);
      expect(listsService.removeItems).toHaveBeenCalledWith('list-1', ['m2']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('undo brings the title back without telling the server', async () => {
    vi.useFakeTimers();
    try {
      const component = setup('owner-1', { canEditItems: true, media: titles }).componentInstance;

      await component.edit.remove(['m2']);
      toastService.success.mock.calls[0][2].run();
      vi.advanceTimersByTime(6000);

      expect(component.edit.media().map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
      expect(listsService.removeItems).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('moves titles locally and sends the whole new order', () => {
    const component = setup('owner-1', { canEditItems: true, media: titles }).componentInstance;
    listsService.reorder.mockImplementation((_id: string, ids: string[]) =>
      of(list({ media: ids.map((id) => ({ id })) as never })),
    );

    component.edit.move(['m3'], 'top');

    expect(component.edit.media().map((m) => m.id)).toEqual(['m3', 'm1', 'm2']);
    expect(listsService.reorder).toHaveBeenCalledWith('list-1', ['m3', 'm1', 'm2']);
  });

  it('autosaves the owner’s renaming as details only', () => {
    vi.useFakeTimers();
    try {
      const fixture = setup('owner-1');
      const component = fixture.componentInstance;

      component.edit.name.set('Renamed');
      fixture.detectChanges();
      vi.advanceTimersByTime(700);

      expect(listsService.updateDetails).toHaveBeenCalledWith('list-1', {
        name: 'Renamed',
        description: 'desc',
        visibility: 'public',
        tags: [],
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('publishing sends the chosen visibility', () => {
    const component = setup('owner-1', { visibility: 'private' }).componentInstance;

    component.publish('link');

    expect(listsService.updateDetails).toHaveBeenCalledWith(
      'list-1',
      expect.objectContaining({ visibility: 'link' }),
    );
  });

  it('deletes a list made from Create when it is left untouched', () => {
    const fixture = setup(
      'owner-1',
      { name: 'studio.untitled_list', description: null, visibility: 'private' },
      { fresh: true },
    );

    fixture.destroy();

    expect(listsService.delete).toHaveBeenCalledWith('list-1');
  });

  it('keeps a list made from Create once it has a title in it', () => {
    const fixture = setup(
      'owner-1',
      {
        name: 'studio.untitled_list',
        description: null,
        visibility: 'private',
        media: titles,
      },
      { fresh: true },
    );

    fixture.destroy();

    expect(listsService.delete).not.toHaveBeenCalled();
  });

  it('keeps a list made from Create once someone is invited to it', () => {
    const fixture = setup(
      'owner-1',
      {
        name: 'studio.untitled_list',
        description: null,
        visibility: 'private',
        pendingInvites: [{ userId: 'u-2' } as MediaListResponse['pendingInvites'][number]],
      },
      { fresh: true },
    );

    fixture.destroy();

    expect(listsService.delete).not.toHaveBeenCalled();
  });

  it('goToMedia navigates to the media detail page', () => {
    const fixture = setup();
    const component = fixture.componentInstance;

    component.goToMedia({ mediaType: 'movie', externalId: '42' } as never);

    expect(router.navigate).toHaveBeenCalledWith(['/media', 'movie', '42']);
  });

  it('offers deletion to the owner only, behind a confirmation', async () => {
    const owner = setup('owner-1').componentInstance;
    expect(buttonByText('studio.delete')).toBeDefined();

    await owner.deleteList();

    expect(confirm.ask).toHaveBeenCalled();
    expect(listsService.delete).toHaveBeenCalledWith('list-1');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/creations?f=lists&scope=MINE', {
      replaceUrl: true,
    });
  });

  it('keeps the list when the deletion is not confirmed', async () => {
    const component = setup('owner-1').componentInstance;
    confirm.ask.mockResolvedValue(false);

    await component.deleteList();

    expect(listsService.delete).not.toHaveBeenCalled();
  });

  it('does not offer deletion to someone else', () => {
    setup('reader-1');
    expect(buttonByText('studio.delete')).toBeUndefined();
  });

  it('keeps the header to direct actions, without share, duplicate or a second invite', () => {
    setup('owner-1');
    const host = fixtureHost();

    for (const label of ['creation.menu.copy_link', 'lists.collab.title', 'studio.duplicate']) {
      expect(host.querySelector(`button[aria-label="${label}"]`)).toBeNull();
    }
    expect(host.querySelector('shelfy-menu-button')).toBeNull();
    expect(host.querySelector('button[aria-label="lists.collab.leave"]')).toBeNull();
  });

  it('shows the filter as one segmented choice with its counts', () => {
    setup('owner-1', { media: titles });
    const links = Array.from(
      fixtureHost().querySelectorAll<HTMLElement>('shelfy-segmented [role="radio"]'),
    );

    expect(links.map((link) => link.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'community.list.all 3',
      'community.list.unseen 3',
    ]);
    expect(links[0].getAttribute('aria-checked')).toBe('true');
  });

  const covers = [1, 2, 3, 4, 5].map((n) => ({
    id: `c${n}`,
    provider: 'tmdb',
    mediaType: 'movie',
    externalId: String(n),
    title: `Cover ${n}`,
    coverUrl: `cover-${n}.jpg`,
  })) as never;

  it('shows up to four covers in the header mosaic', () => {
    setup('reader-1', { media: covers });
    const images = fixtureHost().querySelectorAll('[headerArt] img');

    expect(Array.from(images).map((img) => img.getAttribute('src'))).toEqual([
      'cover-1.jpg',
      'cover-2.jpg',
      'cover-3.jpg',
      'cover-4.jpg',
    ]);
  });

  it('counts the titles in the byline and offers visibility to the owner only', () => {
    const fixture = setup('owner-1', { media: covers, creatorUsername: 'alice' });
    const visibility = () =>
      fixtureHost().querySelector('button[aria-label="studio.change_visibility"]');

    expect(fixture.componentInstance.heroMeta()[0]).toContain('lists.element');
    expect(visibility()).not.toBeNull();

    TestBed.resetTestingModule();
    setup('reader-1');
    expect(visibility()).toBeNull();
  });

  it('names the owner and the co-authors in the byline', () => {
    setup('owner-1', {
      creatorUsername: 'alice',
      creatorAvatarUrl: null,
      collaborators: [{ userId: 'u-bob', username: 'bob', avatarUrl: null }] as never,
    });
    const header = fixtureHost().querySelector('shelfy-media-header')!;

    expect(header.textContent).toContain('alice');
    expect(header.querySelector('a[title="bob"]')).not.toBeNull();
    const buttons = Array.from(header.querySelectorAll('button'));
    expect(
      buttons.some((button) => button.textContent?.includes('lists.collab.invite_button')),
    ).toBe(true);
  });

  it('renders the comments on the Discussion tab', () => {
    const fixture = setup('reader-1');
    expect(fixtureHost().querySelector('shelfy-comments')).toBeNull();

    fixture.componentInstance.selectTab('discussion');
    fixture.detectChanges();

    expect(fixtureHost().querySelector('shelfy-comments')).not.toBeNull();
    expect(fixtureHost().querySelector('shelfy-entity-media-grid')).toBeNull();
  });
});
