import type { ActivatedRoute, Router } from '@angular/router';

export function readLinkToken(route: ActivatedRoute, router: Router): string | null {
  const token =
    new URLSearchParams(route.snapshot.fragment ?? '').get('token') ??
    route.snapshot.queryParamMap.get('token');
  if (token) {
    void router.navigate([], { relativeTo: route, queryParams: {}, replaceUrl: true });
  }
  return token;
}
