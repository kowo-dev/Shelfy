import { filter } from 'rxjs';

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  Router,
  RouterLink,
} from '@angular/router';
import { IconComponent } from '@shared/ui/icon/icon';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { SearchFocusService } from '@app/core/services/search-focus/search-focus';

const TABS = [
  { path: '/discover', icon: 'home', labelKey: 'nav.discover', order: 1 },
  { path: '/collection', icon: 'shelf', labelKey: 'nav.shelf', order: 2 },
  { path: '/creations', icon: 'reviews', labelKey: 'nav.creations', order: 4 },
  { path: '/people', icon: 'people', labelKey: 'nav.people', order: 5 },
];

@Component({
  selector: 'shelfy-bottom-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, TranslatePipe],
  templateUrl: './bottom-nav.html',
})
export class BottomNavComponent {
  private readonly router = inject(Router);
  private readonly searchFocus = inject(SearchFocusService);

  readonly currentRoute = signal(this.router.url);
  readonly tabs = TABS;

  constructor() {
    this.router.events
      .pipe(
        filter(
          (event) =>
            event instanceof NavigationEnd ||
            event instanceof NavigationCancel ||
            event instanceof NavigationError ||
            event instanceof NavigationSkipped,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.currentRoute.set(this.router.url));
  }

  isActive(path: string): boolean {
    const url = this.currentRoute().split(/[?#]/)[0];
    return url === path || url.startsWith(path + '/');
  }

  quickAdd(): void {
    navigator.vibrate?.(8);
    this.searchFocus.open();
  }

  onTab(path: string): void {
    navigator.vibrate?.(6);
    this.currentRoute.set(path);
    if (this.isActive(path)) {
      document.querySelector('.app-main')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}
