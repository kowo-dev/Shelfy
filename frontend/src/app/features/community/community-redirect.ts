import { inject } from '@angular/core';
import { Router, type CanActivateFn, type RedirectFunction } from '@angular/router';
import { parseCommunityUrl } from './data-access/community-url';

export function communityRedirect(view: string | null, extra: Record<string, string> = {}) {
  return () =>
    inject(Router).createUrlTree(['/creations'], {
      queryParams: { ...(view ? { f: view } : {}), ...extra },
    });
}

export const communityPeopleGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  return parseCommunityUrl(route.queryParamMap, true).toPeople
    ? router.createUrlTree(['/people'], { queryParams: { tab: 'discover' } })
    : true;
};

export function keepQueryRedirect(path: string): RedirectFunction {
  return ({ queryParams }) => inject(Router).createUrlTree([path], { queryParams });
}

export function editInPlaceRedirect(base: string, param: string): RedirectFunction {
  return ({ params }) =>
    inject(Router).createUrlTree([base, params[param]], { queryParams: { edit: 1 } });
}

export function profilePeopleRedirect(): RedirectFunction {
  return ({ params, queryParams }) =>
    inject(Router).createUrlTree(['/profile', params['username'], 'connections'], {
      queryParams: { tab: queryParams['tab'] === 'following' ? 'following' : 'followers' },
    });
}
