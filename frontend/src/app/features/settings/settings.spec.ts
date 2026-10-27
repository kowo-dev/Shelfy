import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '@app/core/services/auth/auth';
import type { User } from '@app/core/services/auth/auth.model';
import { CollectionService } from '@app/core/services/collection/collection';
import { LegalService } from '@app/core/services/legal/legal';
import { SteamService } from '@app/core/services/steam/steam';
import { LetterboxdService } from '@app/core/services/letterboxd/letterboxd';
import { SearchService } from '@app/core/services/search/search';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { AniListService } from '@app/core/services/anilist/anilist';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { TranslateService } from '@app/core/services/translate/translate';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { DiscoverService } from '@app/core/services/discover/discover';

import { SettingsPageComponent } from './settings';
import type { SettingsPageData } from './data-access/settings-page';

function pageOf(component: SettingsPageComponent): SettingsPageData {
  return (component as unknown as { page: SettingsPageData }).page;
}

const USER = {
  username: 'kowo',
  displayName: 'Kowo',
  bio: '',
  profileVisibility: 'public',
  isAdultContentAllowed: false,
  isSteamConnected: false,
  isSteamAvailable: true,
} as User;

describe('SettingsPageComponent', () => {
  let router: Router;
  let route: {
    snapshot: { queryParamMap: ReturnType<typeof convertToParamMap>; queryParams: object };
    queryParamMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  };
  let collection: { list: ReturnType<typeof vi.fn> };
  let translate: {
    get: ReturnType<typeof vi.fn>;
    lang: ReturnType<typeof vi.fn>;
  };
  let dateFormat: { use24Hour: ReturnType<typeof vi.fn>; setUse24Hour: ReturnType<typeof vi.fn> };

  function configure(queryParams: Record<string, string> = {}, user: User = USER) {
    route = {
      snapshot: { queryParamMap: convertToParamMap(queryParams), queryParams: {} },
      queryParamMap: new BehaviorSubject(convertToParamMap(queryParams)),
    };
    collection = {
      list: vi
        .fn()
        .mockReturnValue(
          of({ content: [{ media: { coverUrl: 'cover-1' } }, { media: { coverUrl: null } }] }),
        ),
    };
    translate = {
      get: vi.fn((key: string) => key),
      lang: vi.fn(() => 'en'),
    };
    dateFormat = {
      use24Hour: vi.fn(() => false),
      setUse24Hour: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [SettingsPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            currentUser: vi.fn().mockReturnValue(user),
            checkUsernameAvailability: vi.fn().mockReturnValue(of({ isAvailable: true })),
            updateProfile: vi.fn().mockResolvedValue(undefined),
            refreshCurrentUser: vi.fn().mockResolvedValue(undefined),
            uploadAvatar: vi.fn().mockReturnValue(new Promise(() => {})),
            exportData: vi.fn().mockResolvedValue(undefined),
          },
        },
        { provide: CollectionService, useValue: collection },
        {
          provide: LegalService,
          useValue: { getInfo: vi.fn().mockReturnValue(of({ isFederationEnabled: true })) },
        },
        {
          provide: SteamService,
          useValue: {
            getLatestImport: vi.fn().mockReturnValue(of(null)),
            getAuthorizeUrl: vi.fn().mockReturnValue(of({ url: 'https://steam/auth' })),
            disconnect: vi.fn().mockReturnValue(of(undefined)),
            startImport: vi.fn().mockReturnValue(of({ jobId: 'job-1', status: 'pending' })),
          },
        },
        {
          provide: LetterboxdService,
          useValue: {
            getLatestImport: vi.fn().mockReturnValue(of(null)),
            startImport: vi.fn().mockReturnValue(of({ jobId: 'job-1', status: 'pending' })),
          },
        },
        { provide: SearchService, useValue: {} },
        { provide: TmdbService, useValue: { imageUrl: vi.fn((path: string) => path) } },
        {
          provide: DiscoverService,
          useValue: {
            getMovies: vi.fn().mockReturnValue(of({ content: [{ posterPath: 'm1' }] })),
            getSeries: vi.fn().mockReturnValue(of({ content: [{ posterPath: 's1' }] })),
          },
        },
        { provide: IgdbService, useValue: {} },
        { provide: AniListService, useValue: {} },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        {
          provide: ErrorMessageService,
          useValue: { fromApiError: vi.fn().mockReturnValue('err') },
        },
        { provide: TranslateService, useValue: translate },
        { provide: DateFormatService, useValue: dateFormat },
        { provide: ActivatedRoute, useValue: route },
      ],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  }

  function create() {
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('starts on the profile section when none is requested', () => {
    configure({});
    const fixture = create();
    expect(fixture.componentInstance.activeSection()).toBe('profile');
  });

  it('reads the initial section from the query params', () => {
    configure({ section: 'preferences' });
    const fixture = create();
    expect(fixture.componentInstance.activeSection()).toBe('preferences');
  });

  it('maps the retired data section to privacy and opens notifications directly', () => {
    configure({ section: 'data' });
    expect(create().componentInstance.activeSection()).toBe('privacy');
    TestBed.resetTestingModule();
    configure({ section: 'notifications' });
    expect(create().componentInstance.activeSection()).toBe('notifications');
  });

  it('ignores an unknown section query param', () => {
    configure({ section: 'bogus' });
    const fixture = create();
    expect(fixture.componentInstance.activeSection()).toBe('profile');
  });

  it('opens the connections section when a steam query param is present', () => {
    configure({ steam: 'connected' });
    const fixture = create();
    expect(fixture.componentInstance.activeSection()).toBe('connections');
  });

  it('hides the steam card when the instance has no steam key', () => {
    configure({ section: 'connections' }, { ...USER, isSteamAvailable: false });
    const el = create().nativeElement as HTMLElement;
    expect(el.querySelector('shelfy-steam-import-card')).toBeNull();
    expect(el.querySelector('shelfy-letterboxd-import-card')).not.toBeNull();
  });

  it('shows one section at a time with a tab for each', () => {
    configure({});
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('shelfy-settings-hero')).not.toBeNull();
    expect(el.querySelector('shelfy-notification-preferences')).toBeNull();
    expect(el.querySelector('shelfy-danger-zone-card')).toBeNull();
    expect(fixture.componentInstance.tabs().map((tab) => tab.id)).toEqual([
      'profile',
      'preferences',
      'notifications',
      'connections',
      'account',
      'privacy',
      'danger',
    ]);
  });

  it('keeps the neutral page hero with a poster wall, even when the profile has a banner', () => {
    configure({}, { ...USER, profileBannerUrl: 'banner.jpg', profileBannerPosition: 30 } as User);
    const fixture = create();
    const discover = TestBed.inject(DiscoverService) as unknown as {
      getMovies: ReturnType<typeof vi.fn>;
    };

    expect(discover.getMovies).toHaveBeenCalled();
    expect(fixture.componentInstance.wall.posters()).toEqual(['m1', 's1']);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        'shelfy-page-hero img[src="banner.jpg"]',
      ),
    ).toBeNull();
  });

  it('switches sections from the tab bar', () => {
    configure({});
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;
    const rows = Array.from(el.querySelectorAll<HTMLButtonElement>('shelfy-tabs button'));
    expect(rows).toHaveLength(7);
    expect(rows[0].getAttribute('aria-selected')).toBe('true');

    rows[6].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.activeSection()).toBe('danger');
    expect(el.querySelector('shelfy-danger-zone-card')).not.toBeNull();
    expect(el.querySelector('h2')?.textContent).toContain('settings.sections.danger');
  });

  it('selectSection switches the visible section and replaces the section query param', () => {
    configure({});
    const fixture = create();

    fixture.componentInstance.selectSection('account');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.activeSection()).toBe('account');
    expect(el.querySelector('shelfy-email-change-card')).not.toBeNull();
    expect(el.querySelector('shelfy-danger-zone-card')).toBeNull();
    expect(el.querySelector('shelfy-settings-hero')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { section: 'account' },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      }),
    );
  });

  it('follows the section query param when the url changes while on the page', () => {
    configure({});
    const fixture = create();

    route.queryParamMap.next(convertToParamMap({ section: 'notifications' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.activeSection()).toBe('notifications');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('shelfy-notification-preferences'),
    ).not.toBeNull();

    route.queryParamMap.next(convertToParamMap({ section: 'data' }));
    expect(fixture.componentInstance.activeSection()).toBe('privacy');

    route.queryParamMap.next(convertToParamMap({}));
    expect(fixture.componentInstance.activeSection()).toBe('privacy');
  });

  it('selectSection ignores an unknown id', () => {
    configure({});
    const fixture = create();

    fixture.componentInstance.selectSection('bogus');

    expect(fixture.componentInstance.activeSection()).toBe('profile');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('toggle24HourFormat delegates to the date format service', () => {
    configure({});
    const fixture = create();

    fixture.componentInstance.toggle24HourFormat(true);

    expect(dateFormat.setUse24Hour).toHaveBeenCalledWith(true);
  });

  it('displayName prefers displayName over username', () => {
    configure({});
    const fixture = create();
    expect(fixture.componentInstance.displayName()).toBe('Kowo');
  });

  it('avatarBannerUrl falls back to the current user banner when no pending change', () => {
    configure({});
    const fixture = create();
    expect(fixture.componentInstance.avatarBannerUrl()).toBeNull();
  });

  it('hasChanges follows the profile form and the avatar and banner drafts', () => {
    configure({});
    const fixture = create();
    const component = fixture.componentInstance;
    expect(component.hasChanges()).toBe(false);
    expect(component.hasUnsavedChanges()).toBe(false);

    component.form.controls.displayName.setValue('Another name');
    expect(component.hasChanges()).toBe(true);
    expect(component.hasUnsavedChanges()).toBe(true);

    pageOf(component).profileForm.reset();
    expect(component.hasChanges()).toBe(false);

    pageOf(component).banner.clearBanner();
    expect(component.hasChanges()).toBe(true);
  });

  it('delegate methods forward to the underlying page state', () => {
    configure({});
    const fixture = create();
    const component = fixture.componentInstance;
    const page = pageOf(component);

    const toggleAdult = vi.spyOn(page.profileForm, 'toggleAdultContent');
    component.toggleAdultContent(true);
    expect(toggleAdult).toHaveBeenCalledWith(true);

    const confirmAdult = vi.spyOn(page.profileForm, 'confirmAdultContent');
    component.confirmAdultContent();
    expect(confirmAdult).toHaveBeenCalled();

    const closeAdult = vi.spyOn(page.profileForm, 'closeAdultContentConfirmDialog');
    component.closeAdultContentConfirmDialog();
    expect(closeAdult).toHaveBeenCalled();

    const requestEmail = vi.spyOn(page.email, 'requestChange');
    component.requestEmailChange();
    expect(requestEmail).toHaveBeenCalled();

    const openPicker = vi.spyOn(page.banner, 'openPicker');
    component.openBannerPicker();
    expect(openPicker).toHaveBeenCalled();

    const closePicker = vi.spyOn(page.banner, 'closePicker');
    component.closeBannerPicker();
    expect(closePicker).toHaveBeenCalled();

    const queryChange = vi.spyOn(page.banner, 'onQueryChange');
    component.onBannerQueryChange('matrix');
    expect(queryChange).toHaveBeenCalledWith('matrix');

    const loadMoreResults = vi.spyOn(page.banner, 'loadMoreResults');
    component.loadMoreBannerResults();
    expect(loadMoreResults).toHaveBeenCalled();

    const selectMedia = vi.spyOn(page.banner, 'selectMedia');
    component.selectBannerMedia({} as never);
    expect(selectMedia).toHaveBeenCalled();

    const backToSearch = vi.spyOn(page.banner, 'backToSearch');
    component.backToBannerSearch();
    expect(backToSearch).toHaveBeenCalled();

    const selectImage = vi.spyOn(page.banner, 'selectImage');
    component.selectBannerImage({} as never);
    expect(selectImage).toHaveBeenCalled();

    const setPosition = vi.spyOn(page.banner, 'setImagePosition');
    component.setBannerImagePosition(30);
    expect(setPosition).toHaveBeenCalledWith(30);

    const confirmImage = vi.spyOn(page.banner, 'confirmImage');
    component.confirmBannerImage({} as never);
    expect(confirmImage).toHaveBeenCalled();

    const clearBanner = vi.spyOn(page.banner, 'clearBanner');
    component.removeBannerFromPicker();
    expect(clearBanner).toHaveBeenCalled();
    clearBanner.mockClear();
    component.removeBanner();
    expect(clearBanner).toHaveBeenCalledTimes(1);

    const uploadAvatar = vi.spyOn(page.avatar, 'upload');
    const file = new File(['a'], 'a.png');
    component.uploadAvatar(file);
    expect(uploadAvatar).toHaveBeenCalledWith(file);

    const removeAvatar = vi.spyOn(page.avatar, 'remove');
    component.removeAvatar();
    expect(removeAvatar).toHaveBeenCalled();

    const connectSteam = vi.spyOn(page.steamImport, 'connect');
    component.connectSteam();
    expect(connectSteam).toHaveBeenCalled();

    const disconnectSteam = vi.spyOn(page.steamImport, 'disconnect');
    component.disconnectSteam();
    expect(disconnectSteam).toHaveBeenCalled();

    const startSteamImport = vi.spyOn(page.steamImport, 'startImport');
    component.startSteamImport();
    expect(startSteamImport).toHaveBeenCalled();

    const toggleSteamEntries = vi.spyOn(page.steamImport, 'toggleEntries');
    component.toggleImportEntries();
    expect(toggleSteamEntries).toHaveBeenCalled();

    const startLetterboxdImport = vi.spyOn(page.letterboxdImport, 'startImport');
    component.startLetterboxdImport(file);
    expect(startLetterboxdImport).toHaveBeenCalledWith(file);

    const toggleLetterboxdEntries = vi.spyOn(page.letterboxdImport, 'toggleEntries');
    component.toggleLetterboxdImportEntries();
    expect(toggleLetterboxdEntries).toHaveBeenCalled();

    const openDanger = vi.spyOn(page.dangerZone, 'openDialog');
    component.openDangerDialog('clear-collection');
    expect(openDanger).toHaveBeenCalledWith('clear-collection');

    const closeDanger = vi.spyOn(page.dangerZone, 'closeDialog');
    component.closeDangerDialog();
    expect(closeDanger).toHaveBeenCalled();

    const confirmDanger = vi.spyOn(page.dangerZone, 'confirmAction');
    component.confirmDangerAction();
    expect(confirmDanger).toHaveBeenCalled();

    const exportData = vi.spyOn(page.privacy, 'exportData');
    component.exportData();
    expect(exportData).toHaveBeenCalled();
  });

  it('saveAll saves the profile, the avatar then the banner, and ends on saved', async () => {
    vi.useFakeTimers();
    configure({});
    const fixture = create();
    const component = fixture.componentInstance;
    const page = pageOf(component);
    component.form.controls.displayName.setValue('Another name');
    const order: string[] = [];
    vi.spyOn(page.profileForm, 'save').mockImplementation(async () => {
      order.push('profile');
      page.profileForm.reset();
    });
    vi.spyOn(page.avatar, 'save').mockImplementation(async () => void order.push('avatar'));
    vi.spyOn(page.banner, 'save').mockImplementation(async () => void order.push('banner'));

    await component.saveAll();

    expect(order).toEqual(['profile', 'avatar', 'banner']);
    expect(component.saveState()).toBe('saved');
    expect(TestBed.inject(ToastService).success).toHaveBeenCalledWith('settings.saved');
    vi.advanceTimersByTime(700);
    expect(component.saveState()).toBe('idle');
    vi.useRealTimers();
  });

  it('saveAll goes back to idle and keeps the drafts when something failed', async () => {
    configure({});
    const fixture = create();
    const component = fixture.componentInstance;
    const page = pageOf(component);
    page.banner.clearBanner();
    vi.spyOn(page.avatar, 'save').mockResolvedValue(undefined);
    vi.spyOn(page.banner, 'save').mockResolvedValue(undefined);

    await component.saveAll();

    expect(component.hasChanges()).toBe(true);
    expect(component.saveState()).toBe('idle');
    expect(TestBed.inject(ToastService).success).not.toHaveBeenCalled();
  });

  it('saveAll sends back to the profile section when the form is invalid', async () => {
    configure({ section: 'account' });
    const fixture = create();
    const component = fixture.componentInstance;
    const page = pageOf(component);
    component.form.controls.username.setValue('');
    const profileSave = vi.spyOn(page.profileForm, 'save');

    await component.saveAll();

    expect(profileSave).not.toHaveBeenCalled();
    expect(component.activeSection()).toBe('profile');
    expect(TestBed.inject(ToastService).error).toHaveBeenCalledWith('settings.invalid_hint');
  });

  it('saves the Fediverse and adult-content toggles right away, without the profile edits', async () => {
    configure({});
    const fixture = create();
    const component = fixture.componentInstance;
    const updateProfile = TestBed.inject(AuthService).updateProfile as ReturnType<typeof vi.fn>;
    component.form.controls.displayName.setValue('Unsaved name');

    component.toggleFederationShare(false);
    await fixture.whenStable();

    expect(updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Kowo', hasOptedOutOfFederation: true }),
    );
    expect(component.hasChanges()).toBe(true);

    component.toggleAdultContent(true);
    expect(updateProfile).toHaveBeenCalledTimes(1);
    component.confirmAdultContent();
    await fixture.whenStable();

    expect(updateProfile).toHaveBeenCalledTimes(2);
    expect(updateProfile).toHaveBeenLastCalledWith(
      expect.objectContaining({ isAdultContentAllowed: true, confirmAdultContent: true }),
    );
  });

  it('fetches the three latest games and movies as import card covers', () => {
    configure({});
    const component = create().componentInstance;

    expect(collection.list).toHaveBeenCalledWith({ mediaType: ['game'], size: 3 });
    expect(collection.list).toHaveBeenCalledWith({ mediaType: ['movie'], size: 3 });
    expect(component.gameCovers()).toEqual(['cover-1']);
  });

  it('falls back to no covers when the shelf cannot be read', () => {
    configure({});
    collection.list.mockReturnValue(throwError(() => new Error('boom')));
    const component = create().componentInstance;

    expect(component.movieCovers()).toEqual([]);
  });
});
