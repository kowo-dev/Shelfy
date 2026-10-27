import type { Route, Routes } from '@angular/router';

export function warmRoute(routes: Routes, url: string): void {
  visit(routes, segmentsOf(url));
}

function segmentsOf(url: string): string[] {
  return url.split(/[?#]/)[0].split('/').filter(Boolean);
}

function visit(routes: Routes, segments: string[]): boolean {
  for (const route of routes) {
    const path = segmentsOf(route.path ?? '');
    if (path.includes('**') || path.length > segments.length) continue;
    if (!path.every((part, index) => part.startsWith(':') || part === segments[index])) continue;
    const rest = segments.slice(path.length);
    if (typeof route.redirectTo === 'string') {
      if (rest.length === 0 && visit(routes, segmentsOf(route.redirectTo))) return true;
      continue;
    }
    if (route.children) {
      if (visit(route.children, rest)) {
        load(route);
        return true;
      }
      continue;
    }
    if (rest.length) continue;
    load(route);
    return true;
  }
  return false;
}

function load(route: Route): void {
  const loaded = route.loadComponent?.();
  if (loaded instanceof Promise) loaded.catch(() => undefined);
}
