import { ComponentRef, inject, Injectable, Injector } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  DetachedRouteHandle,
  Router,
  RouteReuseStrategy,
} from '@angular/router';
import { AmbientService } from '@app/core/services/ambient/ambient';
import { LayoutService } from '@app/core/services/layout/layout';

const MAX_PAGES = 10;
const TAB_PATHS = new Set(['/discover', '/collection', '/creations', '/people']);

type ScrollPosition = [element: HTMLElement, top: number, left: number];

interface LayoutState {
  navOverlay: boolean;
  navSolidAt: number;
  immersive: boolean;
  scrollTop: number;
}

interface CachedPage {
  handle: DetachedRouteHandle;
  scroll: ScrollPosition[];
  layout: LayoutState;
  ambient: string | null;
  title: string;
}

@Injectable({ providedIn: 'root' })
export class PageCacheStrategy extends RouteReuseStrategy {
  private readonly injector = inject(Injector);
  private readonly layout = inject(LayoutService);
  private readonly ambient = inject(AmbientService);
  private readonly cache = new Map<string, CachedPage>();
  private captured: Omit<CachedPage, 'handle'> | null = null;
  private pendingScroll: ScrollPosition[] | null = null;
  private restoredTitle: string | null = null;

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    if (!isCacheable(route)) return false;
    this.captured = this.capture();
    return true;
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const key = pageKey(route);
    const cached = this.cache.get(key);
    this.cache.delete(key);

    if (!handle) {
      if (!cached) return;
      this.layout.navOverlay.set(cached.layout.navOverlay);
      this.layout.navSolidAt.set(cached.layout.navSolidAt);
      this.layout.immersive.set(cached.layout.immersive);
      this.layout.scrollTop.set(cached.layout.scrollTop);
      void this.ambient.follow(cached.ambient);
      this.pendingScroll = cached.scroll;
      this.restoredTitle = cached.title;
      return;
    }

    if (cached && cached.handle !== handle) destroy(cached.handle);
    if (!this.captured) {
      destroy(handle);
      return;
    }
    this.cache.set(key, { handle, ...this.captured });
    this.captured = null;
    this.evictOverflow();

    this.layout.navOverlay.set(false);
    this.layout.immersive.set(false);
    this.layout.scrollTop.set(0);
    void this.ambient.follow(null);
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    if (!this.cache.has(pageKey(route))) return false;
    const trigger = this.injector.get(Router).currentNavigation()?.trigger;
    return trigger === 'popstate' || TAB_PATHS.has(pagePath(route));
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    return this.cache.get(pageKey(route))?.handle ?? null;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === curr.routeConfig;
  }

  override retrieveStoredRouteHandles(): DetachedRouteHandle[] {
    return [...this.cache.values()].map((page) => page.handle);
  }

  restoreScroll(): boolean {
    const positions = this.pendingScroll;
    this.pendingScroll = null;
    if (!positions) return false;
    for (const [element, top, left] of positions) {
      element.scrollTop = top;
      element.scrollLeft = left;
    }
    return true;
  }

  takeRestoredTitle(): string | null {
    const title = this.restoredTitle;
    this.restoredTitle = null;
    return title;
  }

  clear(): void {
    for (const page of this.cache.values()) destroy(page.handle);
    this.cache.clear();
    this.pendingScroll = null;
  }

  private capture(): Omit<CachedPage, 'handle'> {
    const main = document.querySelector<HTMLElement>('.app-main');
    const scroll: ScrollPosition[] = [];
    if (main) {
      scroll.push([main, main.scrollTop, main.scrollLeft]);
      for (const element of main.querySelectorAll<HTMLElement>('*')) {
        if (element.scrollTop > 0 || element.scrollLeft > 0)
          scroll.push([element, element.scrollTop, element.scrollLeft]);
      }
    }
    return {
      scroll,
      layout: {
        navOverlay: this.layout.navOverlay(),
        navSolidAt: this.layout.navSolidAt(),
        immersive: this.layout.immersive(),
        scrollTop: this.layout.scrollTop(),
      },
      ambient: this.ambient.current,
      title: document.title,
    };
  }

  private evictOverflow(): void {
    while (this.cache.size > MAX_PAGES) {
      const [oldestKey, oldest] = this.cache.entries().next().value!;
      this.cache.delete(oldestKey);
      destroy(oldest.handle);
    }
  }
}

function isCacheable(route: ActivatedRouteSnapshot): boolean {
  return (
    !!route.component &&
    !route.firstChild &&
    route.parent?.routeConfig?.path === '' &&
    !route.routeConfig?.canDeactivate?.length &&
    route.data['keepAlive'] !== false
  );
}

function pagePath(route: ActivatedRouteSnapshot): string {
  return (
    '/' +
    route.pathFromRoot
      .flatMap((r) => r.url.map((segment) => segment.path))
      .filter(Boolean)
      .join('/')
  );
}

function pageKey(route: ActivatedRouteSnapshot): string {
  const params = route.queryParamMap;
  const query = params.keys
    .sort()
    .flatMap((key) => params.getAll(key).map((value) => `${key}=${value}`))
    .join('&');
  return query ? `${pagePath(route)}?${query}` : pagePath(route);
}

function destroy(handle: DetachedRouteHandle): void {
  (handle as { componentRef?: ComponentRef<unknown> }).componentRef?.destroy();
}
