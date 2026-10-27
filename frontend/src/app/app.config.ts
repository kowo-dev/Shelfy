import {
  ApplicationConfig,
  DOCUMENT,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  isDevMode,
} from '@angular/core';
import { markBrokenImages } from '@shared/utils/broken-image.util';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  RouteReuseStrategy,
  TitleStrategy,
  withPreloading,
  withViewTransitions,
} from '@angular/router';
import { PageCacheStrategy } from './core/services/page-cache/page-cache-strategy';
import { PageTitleStrategy } from './core/services/title/page-title-strategy';
import { RoutePreloadStrategy } from './core/services/route-preload/route-preload';
import { warmRoute } from './core/services/route-preload/route-warmup';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { provideUiIcons } from './shared/ui/icon/ui-icons';
import { TranslateService } from './core/services/translate/translate';
import { AuthService } from './core/services/auth/auth';
import { authInterceptor } from './core/interceptors/auth-interceptor';
import { apiErrorInterceptor } from './core/interceptors/api-error.interceptor';
import { provideServiceWorker } from '@angular/service-worker';
import { AppUpdateService } from './core/services/app-update/app-update';

function routePath(snapshot: ActivatedRouteSnapshot): string {
  return [...snapshot.url.map((segment) => segment.path), ...snapshot.children.map(routePath)].join(
    '/',
  );
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withPreloading(RoutePreloadStrategy),
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: ({ transition, from, to }) => {
          if (routePath(from) === routePath(to)) {
            transition.skipTransition();
            return;
          }
          const root = document.documentElement;
          const settle = () => root.removeAttribute('data-view-leaving');
          root.setAttribute('data-view-leaving', '');
          transition.updateCallbackDone.then(settle, settle);
        },
      }),
    ),
    { provide: TitleStrategy, useExisting: PageTitleStrategy },
    { provide: RouteReuseStrategy, useExisting: PageCacheStrategy },
    provideHttpClient(withInterceptors([apiErrorInterceptor, authInterceptor])),
    provideUiIcons(),
    provideAppInitializer(() => inject(AppUpdateService).checkAtStartup()),
    provideAppInitializer(() => warmRoute(routes, globalThis.location?.pathname ?? '/')),
    provideAppInitializer(() => inject(TranslateService).init()),
    provideAppInitializer(() => inject(AuthService).init()),
    provideAppInitializer(() => markBrokenImages(inject(DOCUMENT))),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
