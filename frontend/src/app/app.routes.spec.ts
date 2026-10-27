import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, type RedirectFunction, type Route } from '@angular/router';
import { routes } from './app.routes';

interface Flat {
  path: string;
  route: Route;
}

function flatten(list: Route[], prefix = ''): Flat[] {
  return list.flatMap((route) => {
    const path = [prefix, route.path].filter(Boolean).join('/');
    return [{ path, route }, ...flatten(route.children ?? [], path)];
  });
}

describe('routes', () => {
  const all = flatten(routes);
  const lazy = all.filter(({ route }) => route.loadComponent);

  it('has no empty or duplicated sibling path', () => {
    const paths = all.filter(({ route }) => route.path !== undefined && !route.children);
    const keys = paths.map(({ path, route }) => `${path}|${route.canMatch ? 'guarded' : ''}`);

    expect(keys.length).toBeGreaterThan(30);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(lazy.map(({ path, route }) => [path || '(root)', route] as const))(
    'loads the page of %s',
    async (_path, route) => {
      const component = await (route.loadComponent as () => Promise<unknown>)();

      expect(component).toBeTruthy();
    },
  );

  it('ends with a catch-all that shows the not found page', () => {
    const last = routes[routes.length - 1];

    expect(last.path).toBe('**');
  });

  it('keeps pages that need an account behind the auth guard', () => {
    const guarded = all.filter(({ route }) => route.canActivate?.length);

    expect(guarded.map(({ path }) => path)).toEqual(expect.arrayContaining(['reviews/new']));
  });

  it('sends the old reviews page of a profile to the reviews of its creations', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const redirect = all.find(({ path }) => path === 'profile/:username/reviews')?.route
      .redirectTo as RedirectFunction;
    const tree = TestBed.runInInjectionContext(() =>
      redirect({ params: { username: 'lea' } } as unknown as Parameters<RedirectFunction>[0]),
    );

    expect(TestBed.inject(Router).serializeUrl(tree as ReturnType<Router['parseUrl']>)).toBe(
      '/profile/lea/lists?f=reviews',
    );
  });
});
