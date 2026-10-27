import { TestBed } from '@angular/core/testing';
import {
  convertToParamMap,
  provideRouter,
  Router,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
  type UrlTree,
} from '@angular/router';
import { communityPeopleGuard, communityRedirect, keepQueryRedirect } from '../community-redirect';
import { parseCommunityUrl, scopeParam, tabParams } from './community-url';

const parse = (params: Record<string, string>, signedIn: boolean) =>
  parseCommunityUrl(convertToParamMap(params), signedIn);

describe('parseCommunityUrl', () => {
  it('opens on Reviews from everyone', () => {
    expect(parse({}, true)).toMatchObject({ view: 'reviews', scope: 'ALL', sort: 'RECENT' });
    expect(parse({}, false)).toMatchObject({ view: 'reviews', scope: 'ALL' });
  });

  it('reads the tab', () => {
    for (const f of ['reviews', 'lists', 'versus']) expect(parse({ f }, true).view).toBe(f);
  });

  it('sends the old Feed and All tabs to Reviews', () => {
    expect(parse({ f: 'feed' }, true).view).toBe('reviews');
    expect(parse({ f: 'all' }, true).view).toBe('reviews');
  });

  it('always resolves to Everyone without an account, whatever the URL says', () => {
    expect(parse({ f: 'lists', scope: 'MINE' }, false).scope).toBe('ALL');
    expect(parse({ f: 'mine' }, false)).toMatchObject({ view: 'lists', scope: 'ALL' });
  });

  it('honours an explicit scope', () => {
    expect(parse({ f: 'lists', scope: 'CIRCLE' }, true).scope).toBe('CIRCLE');
    expect(parse({ scope: 'MINE' }, true).scope).toBe('MINE');
  });

  it('ignores unknown scope, sort and view values', () => {
    expect(parse({ scope: 'EVERYBODY', sort: 'RANDOM', f: 'nope' }, true)).toMatchObject({
      view: 'reviews',
      scope: 'ALL',
      sort: 'RECENT',
    });
  });

  it('maps the legacy f=mine alias to Lists with the Mine scope', () => {
    expect(parse({ f: 'mine' }, true)).toMatchObject({ view: 'lists', scope: 'MINE' });
  });

  it('flags the legacy f=people alias for a redirect to /connections', () => {
    expect(parse({ f: 'people' }, true)).toMatchObject({ toPeople: true, view: 'reviews' });
    expect(parse({ f: 'lists' }, true).toPeople).toBe(false);
  });

  it('reads the sort and the search query', () => {
    expect(parse({ sort: 'POPULAR', q: 'zelda' }, true)).toMatchObject({
      sort: 'POPULAR',
      query: 'zelda',
    });
  });

  it('only opens the creation sheet for a signed-in account and a known kind', () => {
    expect(parse({ create: 'list' }, true).create).toBe('list');
    expect(parse({ create: 'versus' }, true).create).toBe('versus');
    expect(parse({ create: 'review' }, true).create).toBeNull();
    expect(parse({ create: 'list' }, false).create).toBeNull();
    expect(parse({ create: 'award' }, true).create).toBeNull();
  });
});

describe('scopeParam', () => {
  it('leaves Everyone implicit and writes any other scope', () => {
    expect(scopeParam('ALL')).toBeNull();
    expect(scopeParam('CIRCLE')).toBe('CIRCLE');
    expect(scopeParam('MINE')).toBe('MINE');
  });
});

describe('tabParams', () => {
  it('carries the scope and always names the view', () => {
    expect(tabParams('lists', 'CIRCLE')).toEqual({ f: 'lists', scope: 'CIRCLE' });
    expect(tabParams('versus', 'MINE')).toEqual({ f: 'versus', scope: 'MINE' });
    expect(tabParams('reviews', 'ALL')).toEqual({ f: 'reviews', scope: null });
  });
});

describe('legacy routes', () => {
  const urlOf = (tree: UrlTree) => TestBed.inject(Router).serializeUrl(tree);

  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('/lists and /versus keep landing on their tab', () => {
    const tree = TestBed.runInInjectionContext(() => communityRedirect('lists')());
    expect(urlOf(tree)).toBe('/creations?f=lists');
  });

  it('/community and /connections move to their new names with the query intact', () => {
    const redirect = (path: string, queryParams: Record<string, string>) =>
      TestBed.runInInjectionContext(() =>
        keepQueryRedirect(path)({ queryParams } as Parameters<
          ReturnType<typeof keepQueryRedirect>
        >[0]),
      ) as UrlTree;

    expect(urlOf(redirect('/creations', { f: 'lists', scope: 'MINE' }))).toBe(
      '/creations?f=lists&scope=MINE',
    );
    expect(urlOf(redirect('/people', { tab: 'following' }))).toBe('/people?tab=following');
  });

  describe('communityPeopleGuard', () => {
    const run = (params: Record<string, string>) =>
      TestBed.runInInjectionContext(() =>
        communityPeopleGuard(
          { queryParamMap: convertToParamMap(params) } as ActivatedRouteSnapshot,
          {} as RouterStateSnapshot,
        ),
      );

    it('sends f=people to the Suggestions tab of People', () => {
      expect(urlOf(run({ f: 'people' }) as UrlTree)).toBe('/people?tab=discover');
    });

    it('lets every other Community URL through', () => {
      expect(run({})).toBe(true);
      expect(run({ f: 'mine' })).toBe(true);
      expect(run({ f: 'lists', scope: 'MINE' })).toBe(true);
    });
  });
});
