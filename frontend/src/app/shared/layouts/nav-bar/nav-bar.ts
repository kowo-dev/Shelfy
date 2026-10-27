import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '@app/core/services/auth/auth';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { LayoutService } from '@app/core/services/layout/layout';
import { SearchFocusService } from '@app/core/services/search-focus/search-focus';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { AvatarComponent } from '@shared/ui/avatar/avatar';
import { ButtonComponent, buttonClasses } from '@shared/ui/button/button';
import { DialogComponent } from '@shared/ui/dialog/dialog';
import { IconComponent } from '@shared/ui/icon/icon';
import { MENU_ITEM, MENU_PANEL, MENU_SEPARATOR } from '@shared/ui/ui-recipes';
import { NotificationInbox } from '@app/core/services/notifications/notification-inbox';
import { environment } from '@env';
import { injectRegistrationOpen } from '@app/core/services/legal/legal';
import {
  ADMIN,
  DESKTOP_DESTINATIONS,
  EXPLORE,
  NOTIFICATIONS,
  PROFILE,
  SETTINGS,
  ownsUrl,
  visibleTo,
  type NavDestination,
} from '../nav-sections';
import { mediaQuerySignal } from '@shared/utils/media-query.util';

type MenuId = 'account';

@Component({
  selector: 'shelfy-nav-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    TranslatePipe,
    AvatarComponent,
    ButtonComponent,
    DialogComponent,
    IconComponent,
  ],
  templateUrl: './nav-bar.html',
  host: {
    class: 'contents',
    '(document:keydown)': 'onKeydown($event)',
    '(document:pointerdown)': 'onDocumentPointer($event)',
  },
})
export class NavBarComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly searchFocus = inject(SearchFocusService);
  private readonly layout = inject(LayoutService);
  private readonly toastService = inject(ToastService);
  private readonly errorMessage = inject(ErrorMessageService);

  readonly accountLinks = [PROFILE, NOTIFICATIONS];
  readonly settings = SETTINGS;
  readonly explore = EXPLORE;
  readonly shortcutLabel = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '')
    ? '⌘K'
    : 'Ctrl K';
  readonly adminLink = ADMIN;

  readonly menuPanel = MENU_PANEL;
  readonly menuItem = MENU_ITEM;
  readonly notificationsPath = NOTIFICATIONS.path;
  readonly menuSeparator = MENU_SEPARATOR;
  readonly version = environment.version;
  readonly signInClass = buttonClasses({ variant: 'secondary' });
  readonly registerClass = buttonClasses({ variant: 'primary' });

  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly registrationOpen = injectRegistrationOpen(computed(() => !this.isAuthenticated()));
  protected readonly inbox = inject(NotificationInbox);
  readonly isAdmin = computed(() => this.auth.currentUser()?.isAdmin === true);

  readonly primaryLinks = computed(() =>
    DESKTOP_DESTINATIONS.filter(visibleTo(this.isAuthenticated())),
  );
  readonly logoutDialogOpen = signal(false);
  readonly openMenu = signal<MenuId | null>(null);

  private readonly url = signal(this.router.url);

  readonly overlay = this.layout.navOverlay;
  private readonly phone = mediaQuerySignal('(width < 48rem)');
  readonly solid = computed(() =>
    this.phone()
      ? this.layout.scrollTop() > 0
      : !this.layout.navOverlay() || this.layout.scrollTop() > this.layout.navSolidAt(),
  );

  readonly displayName = computed(() => {
    const user = this.auth.currentUser();
    return user?.displayName ?? user?.username ?? '';
  });
  readonly username = computed(() => this.auth.currentUser()?.username ?? '');
  readonly avatarUrl = computed(() => this.auth.currentUser()?.avatarUrl ?? '');

  readonly activeKey = computed(
    () => this.primaryLinks().find((item) => ownsUrl(this.url(), item))?.path ?? null,
  );

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        this.url.set(event.urlAfterRedirects);
        this.openMenu.set(null);
      });
  }

  isActive(link: NavDestination): boolean {
    return ownsUrl(this.url(), link);
  }

  menuId(id: string): string {
    return `nav-menu-${id}`;
  }

  toggleMenu(id: MenuId): void {
    this.openMenu.update((current) => (current === id ? null : id));
  }

  onTriggerKeydown(event: KeyboardEvent, id: MenuId): void {
    if (event.key !== 'ArrowDown' && event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.openMenu.set(id);
    setTimeout(() => this.menuItems(id)[0]?.focus());
  }

  onMenuKeydown(event: KeyboardEvent, id: MenuId): void {
    const items = this.menuItems(id);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const moves: Record<string, number> = {
      ArrowDown: (index + 1) % items.length,
      ArrowUp: (index - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      items[moves[event.key]]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closeAndFocusTrigger(id);
    } else if (event.key === 'Tab') {
      this.openMenu.set(null);
    }
  }

  private menuItems(id: MenuId): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>(`#${this.menuId(id)} [role="menuitem"]`)];
  }

  private closeAndFocusTrigger(id: MenuId): void {
    this.openMenu.set(null);
    document.querySelector<HTMLElement>(`[aria-controls="${this.menuId(id)}"]`)?.focus();
  }

  onDocumentPointer(event: PointerEvent): void {
    const menu = this.openMenu();
    if (!menu) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest(`[data-menu-root="${menu}"]`)) return;
    this.openMenu.set(null);
  }

  openSearch(): void {
    this.openMenu.set(null);
    this.searchFocus.open();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.openMenu()) {
      this.closeAndFocusTrigger(this.openMenu()!);
      return;
    }
    const target = event.target as HTMLElement | null;
    const typing =
      !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    const commandK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
    if (commandK || (event.key === '/' && !typing)) {
      event.preventDefault();
      this.openSearch();
    }
  }

  openLogoutDialog(): void {
    this.openMenu.set(null);
    this.logoutDialogOpen.set(true);
  }

  closeLogoutDialog(): void {
    this.logoutDialogOpen.set(false);
  }

  async confirmLogout(): Promise<void> {
    this.closeLogoutDialog();
    await this.router.navigate(['/auth/login'], { state: { signingOut: true } });
    try {
      await this.auth.logout();
    } catch (error) {
      catchAndToastError(this.toastService, this.errorMessage)(error);
    }
  }
}
