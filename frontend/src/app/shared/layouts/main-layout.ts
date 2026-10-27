import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Data, NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { NavBarComponent } from './nav-bar/nav-bar';
import { LayoutService } from '@app/core/services/layout/layout';
import { BottomNavComponent } from './bottom-nav/bottom-nav';
import { CelebrationComponent } from '../ui/celebration/celebration';
import { ToastContainerComponent } from '../ui/toast/toast';
import { ConfirmDialogComponent } from '../ui/confirm-dialog/confirm-dialog';
import { AuthPromptDialogComponent } from '../ui/auth-prompt-dialog/auth-prompt-dialog';
import { CollectSheetComponent } from '../ui/collect-sheet/collect-sheet';
import { ItemSheetComponent } from '../ui/item-sheet/item-sheet';
import { BulkSheetComponent } from '../ui/bulk-sheet/bulk-sheet';
import { ItemSheetService } from '@app/core/services/item-sheet/item-sheet';
import { PageCacheStrategy } from '@app/core/services/page-cache/page-cache-strategy';
import { guardTapsWhileScrolling } from '../utils/scroll-tap-guard';

@Component({
  selector: 'shelfy-main-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    NavBarComponent,
    BottomNavComponent,
    ToastContainerComponent,
    CelebrationComponent,
    AuthPromptDialogComponent,
    ConfirmDialogComponent,
    ItemSheetComponent,
    CollectSheetComponent,
    BulkSheetComponent,
  ],
  template: `
    <svg width="0" height="0" class="absolute" aria-hidden="true">
      <symbol id="shelfy-laurel" viewBox="0 0 40 64">
        <path
          d="M30 62C14 52 8 36 12 6"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
        />
        <g fill="currentColor">
          <ellipse cx="7" cy="12" rx="2.6" ry="6" transform="rotate(-28 7 12)" />
          <ellipse cx="17" cy="11" rx="2.4" ry="5.4" transform="rotate(32 17 11)" />
          <ellipse cx="5" cy="24" rx="2.6" ry="6" transform="rotate(-48 5 24)" />
          <ellipse cx="16" cy="22" rx="2.4" ry="5.4" transform="rotate(20 16 22)" />
          <ellipse cx="7" cy="36" rx="2.6" ry="6" transform="rotate(-62 7 36)" />
          <ellipse cx="18" cy="33" rx="2.4" ry="5.2" transform="rotate(8 18 33)" />
          <ellipse cx="13" cy="47" rx="2.6" ry="6" transform="rotate(-74 13 47)" />
          <ellipse cx="23" cy="44" rx="2.2" ry="5" transform="rotate(-6 23 44)" />
          <ellipse cx="22" cy="56" rx="2.4" ry="5.4" transform="rotate(-86 22 56)" />
        </g>
      </symbol>
      <mask id="shelfy-laurel-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="40" height="64">
        <use href="#shelfy-laurel" width="40" height="64" color="#fff" />
      </mask>
    </svg>
    <div class="bg-background relative mx-auto flex h-dvh overflow-hidden">
      <div class="relative flex min-w-0 flex-1 flex-col">
        <shelfy-nav-bar />
        <main
          #mainScroll
          class="app-main relative h-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto pb-(--bottom-nav-clearance) [scroll-timeline:--app-main_block] md:pb-0"
          [style.padding-bottom]="layout.immersive() ? '0' : null"
          (scroll)="onMainScroll($event)"
        >
          <router-outlet></router-outlet>
        </main>
      </div>
      @if (!layout.immersive()) {
        <shelfy-bottom-nav class="md:hidden" />
      }
    </div>
    @defer (when itemSheet.item(); prefetch on idle) {
      @if (itemSheet.item(); as item) {
        <shelfy-item-sheet
          [item]="item"
          (closed)="itemSheet.close()"
          (updated)="itemSheet.notifyUpdated($event)"
        />
      }
    }
    @defer (when itemSheet.bulk(); prefetch on idle) {
      @if (itemSheet.bulk(); as bulk) {
        <shelfy-bulk-sheet
          [items]="bulk.items"
          [statuses]="bulk.statuses"
          (closed)="itemSheet.close()"
          (applied)="itemSheet.bulkApplied.next($event)"
        />
      }
    }
    <shelfy-collect-sheet />
    <shelfy-celebration />
    <shelfy-toast-container />
    <shelfy-auth-prompt-dialog />
    <shelfy-confirm-dialog />
  `,
})
export class MainLayoutComponent {
  protected readonly layout = inject(LayoutService);
  protected readonly itemSheet = inject(ItemSheetService);
  private readonly mainScroll = viewChild<ElementRef<HTMLElement>>('mainScroll');
  private readonly pageCache = inject(PageCacheStrategy);
  private lastPath = '';

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pageCache.clear());
    const document = inject(DOCUMENT);
    inject(DestroyRef).onDestroy(guardTapsWhileScrolling(document));
    const router = inject(Router);
    let backOrForward = false;
    let routeOverlay = false;
    router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart) backOrForward = event.navigationTrigger === 'popstate';
      if (!(event instanceof NavigationEnd)) return;
      const path = event.urlAfterRedirects.split(/[?#]/)[0];
      const changed = path !== this.lastPath;
      this.lastPath = path;
      const restored = this.pageCache.restoreScroll();
      const overlay = !!leafData(router)['navOverlay'];
      if (overlay) this.layout.navOverlay.set(true);
      else if (routeOverlay && !restored) this.layout.navOverlay.set(false);
      routeOverlay = overlay;
      if (restored || !changed || backOrForward) return;
      const main = this.mainScroll()?.nativeElement;
      if (main) main.scrollTop = 0;
      this.layout.scrollTop.set(0);
    });
  }

  onMainScroll(event: Event): void {
    this.layout.scrollTop.set((event.target as HTMLElement).scrollTop);
  }
}

function leafData(router: Router): Data {
  let route = router.routerState.snapshot.root;
  while (route.firstChild) route = route.firstChild;
  return route.data;
}
