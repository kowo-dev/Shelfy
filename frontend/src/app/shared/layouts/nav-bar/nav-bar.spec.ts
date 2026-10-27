import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '@app/core/services/auth/auth';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { LayoutService } from '@app/core/services/layout/layout';
import { SearchFocusService } from '@app/core/services/search-focus/search-focus';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { NavBarComponent } from './nav-bar';

describe('NavBarComponent', () => {
  let events: Subject<unknown>;
  let navigate: ReturnType<typeof vi.fn>;
  let auth: {
    isAuthenticated: ReturnType<typeof signal<boolean>>;
    currentUser: ReturnType<typeof signal<Record<string, unknown> | null>>;
    logout: ReturnType<typeof vi.fn>;
  };
  let search: { open: ReturnType<typeof vi.fn> };
  let layout: {
    navOverlay: ReturnType<typeof signal<boolean>>;
    scrollTop: ReturnType<typeof signal<number>>;
    navSolidAt: ReturnType<typeof signal<number>>;
  };
  let toast: { error: ReturnType<typeof vi.fn> };

  function setup(url = '/discover') {
    events = new Subject();
    navigate = vi.fn().mockResolvedValue(true);
    auth = {
      isAuthenticated: signal(true),
      currentUser: signal({ username: 'kowo', displayName: null, avatarUrl: null }),
      logout: vi.fn().mockResolvedValue(undefined),
    };
    search = { open: vi.fn() };
    layout = { navOverlay: signal(false), scrollTop: signal(0), navSolidAt: signal(300) };
    toast = { error: vi.fn() };
    TestBed.overrideComponent(NavBarComponent, { set: { template: '', imports: [] } });
    TestBed.configureTestingModule({
      imports: [NavBarComponent],
      providers: [
        { provide: Router, useValue: { url, events, navigate } },
        { provide: AuthService, useValue: auth },
        { provide: SearchFocusService, useValue: search },
        { provide: LayoutService, useValue: layout },
        { provide: ToastService, useValue: toast },
        { provide: ErrorMessageService, useValue: { fromApiError: () => 'failed' } },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    const fixture = TestBed.createComponent(NavBarComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const key = (init: KeyboardEventInit, target?: Partial<HTMLElement>) => {
    const event = new KeyboardEvent('keydown', { cancelable: true, ...init });
    if (target) Object.defineProperty(event, 'target', { value: target });
    return event;
  };

  it('marks the section that owns the current URL', () => {
    const nav = setup('/lists/abc?tab=items');

    expect(nav.activeKey()).toBe('/creations');
  });

  it('follows navigation and closes any open menu', () => {
    const nav = setup('/discover');
    nav.toggleMenu('account');

    events.next(new NavigationEnd(1, '/collection', '/collection'));

    expect(nav.activeKey()).toBe('/collection');
    expect(nav.openMenu()).toBeNull();
  });

  it('shows the administration entry only to admins', () => {
    const nav = setup();
    expect(nav.isAdmin()).toBe(false);

    auth.currentUser.set({ username: 'kowo', isAdmin: true });
    expect(nav.isAdmin()).toBe(true);
  });

  it('hides sections that need an account from a guest', () => {
    const nav = setup();
    expect(nav.primaryLinks().map((link) => link.path)).toEqual([
      '/discover',
      '/collection',
      '/creations',
      '/people',
    ]);

    auth.isAuthenticated.set(false);

    expect(nav.primaryLinks().map((link) => link.path)).toEqual(['/discover', '/creations']);
  });

  it('turns solid only after scrolling past the overlay threshold', () => {
    const nav = setup();
    expect(nav.solid()).toBe(true);

    layout.navOverlay.set(true);
    expect(nav.solid()).toBe(false);

    layout.scrollTop.set(301);
    expect(nav.solid()).toBe(true);
  });

  it('shows the display name, falling back to the username', () => {
    const nav = setup();
    expect(nav.displayName()).toBe('kowo');

    auth.currentUser.set({ username: 'kowo', displayName: 'Kowo' });
    expect(nav.displayName()).toBe('Kowo');

    auth.currentUser.set(null);
    expect(nav.username()).toBe('');
  });

  it('toggles a menu open and closed', () => {
    const nav = setup();

    nav.toggleMenu('account');
    expect(nav.openMenu()).toBe('account');
    nav.toggleMenu('account');
    expect(nav.openMenu()).toBeNull();
  });

  it('closes the menu on a click outside it but not inside', () => {
    const nav = setup();
    nav.toggleMenu('account');
    const inside = { closest: (selector: string) => selector.includes('account') } as HTMLElement;
    const outside = { closest: () => null } as unknown as HTMLElement;

    nav.onDocumentPointer({ target: inside } as unknown as PointerEvent);
    expect(nav.openMenu()).toBe('account');

    nav.onDocumentPointer({ target: outside } as unknown as PointerEvent);
    expect(nav.openMenu()).toBeNull();
  });

  describe('keyboard', () => {
    it.each([[{ key: 'k', ctrlKey: true }], [{ key: 'K', metaKey: true }], [{ key: '/' }]])(
      'opens the search with %o',
      (init) => {
        const nav = setup();
        const event = key(init, { tagName: 'BODY' });

        nav.onKeydown(event);

        expect(search.open).toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(true);
      },
    );

    it('does not steal the slash from a field the user is typing in', () => {
      const nav = setup();

      nav.onKeydown(key({ key: '/' }, { tagName: 'INPUT' }));
      nav.onKeydown(key({ key: '/' }, { tagName: 'DIV', isContentEditable: true }));

      expect(search.open).not.toHaveBeenCalled();
    });

    it('opens the menu from its trigger with the arrow or enter key only', () => {
      const nav = setup();

      nav.onTriggerKeydown(key({ key: 'a' }), 'account');
      expect(nav.openMenu()).toBeNull();

      nav.onTriggerKeydown(key({ key: 'ArrowDown' }), 'account');
      expect(nav.openMenu()).toBe('account');
    });

    it('closes the menu when tabbing out of it', () => {
      const nav = setup();
      nav.toggleMenu('account');

      nav.onMenuKeydown(key({ key: 'Tab' }), 'account');

      expect(nav.openMenu()).toBeNull();
    });

    it('closes an open menu on Escape instead of reaching the page', () => {
      const nav = setup();
      nav.toggleMenu('account');

      nav.onKeydown(key({ key: 'Escape' }));

      expect(nav.openMenu()).toBeNull();
    });
  });

  it('opening the search closes the menu first', () => {
    const nav = setup();
    nav.toggleMenu('account');

    nav.openSearch();

    expect(nav.openMenu()).toBeNull();
    expect(search.open).toHaveBeenCalled();
  });

  it('signs out and goes to the login page', async () => {
    const nav = setup();

    await nav.confirmLogout();

    expect(auth.logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], { state: { signingOut: true } });
    expect(nav.logoutDialogOpen()).toBe(false);
  });

  it('still leaves for the login page and tells the user when signing out fails', async () => {
    const nav = setup();
    auth.logout.mockRejectedValue(new Error('boom'));

    await nav.confirmLogout();

    expect(toast.error).toHaveBeenCalledWith('failed');
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], { state: { signingOut: true } });
  });
});
