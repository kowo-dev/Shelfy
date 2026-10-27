import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError, type Observable } from 'rxjs';
import { vi, type Mock } from 'vitest';
import {
  EMPTY_EXPLORE_QUERY,
  type ExploreCriterion,
  type ExploreQuery,
} from '@app/core/services/search/explore-query';
import { ExploreCatalogService } from '@app/core/services/search/explore-catalog';
import { SearchService } from '@app/core/services/search/search';
import type { ExploreOption } from '@app/core/services/search/search.model';
import { TranslateService } from '@app/core/services/translate/translate';
import { ExploreFiltersComponent, type ExploreFacet } from './explore-filters/explore-filters';

const translate = {
  get: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${Object.values(params).join(',')}` : key,
  lang: () => 'en',
};

const crit = (token: string): ExploreCriterion => ({ token, label: null });

describe('ExploreFiltersComponent', () => {
  let catalogOptions: Mock<SearchService['catalogOptions']>;
  const streaming = signal<unknown[]>([]);

  function render(
    query: Partial<ExploreQuery> = {},
    options$: Observable<ExploreOption[]> = of([{ id: 'tmdb-1', label: 'Drama' } as ExploreOption]),
    facet: ExploreFacet | null = null,
  ) {
    catalogOptions = vi.fn<SearchService['catalogOptions']>().mockReturnValue(options$);
    TestBed.configureTestingModule({
      imports: [ExploreFiltersComponent],
      providers: [
        { provide: SearchService, useValue: { catalogOptions } },
        {
          provide: ExploreCatalogService,
          useValue: {
            entries: () => [],
            streamingServices: streaming,
            vocabulary: () => null,
            region: () => 'FR',
            typeLabel: (type: string) => type,
            label: (criterion: ExploreCriterion) => criterion.token,
          },
        },
        { provide: TranslateService, useValue: translate },
      ],
    });
    const fixture = TestBed.createComponent(ExploreFiltersComponent);
    fixture.componentRef.setInput('query', { ...EMPTY_EXPLORE_QUERY, ...query });
    fixture.componentRef.setInput('facet', facet);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('reads a criterion state from the query', () => {
    const filters = render({ with: [crit('a')], without: [crit('b')] });

    expect(filters.state('a')).toBe('include');
    expect(filters.state('b')).toBe('exclude');
    expect(filters.state('c')).toBe('off');
  });

  it('cycles include, then exclude, then off', () => {
    const emitted = vi.fn();
    const filters = render({ with: [crit('a')], without: [crit('b')] });
    filters.cycled.subscribe(emitted);

    filters.cycle(crit('c'));
    filters.cycle(crit('a'));
    filters.cycle(crit('b'));

    expect(emitted.mock.calls.map(([event]) => event.state)).toEqual(['include', 'exclude', 'off']);
  });

  it('skips exclusion when it is not allowed', () => {
    const emitted = vi.fn();
    const filters = render({ with: [crit('a')] });
    filters.cycled.subscribe(emitted);

    filters.cycle(crit('a'), false);

    expect(emitted).toHaveBeenCalledWith({ criterion: crit('a'), state: 'off' });
  });

  it('accepts a plausible year and ignores an impossible one', () => {
    const emitted = vi.fn();
    const filters = render({ from: 1990 });
    filters.yearsChanged.subscribe(emitted);
    const type = (edge: 'from' | 'to', value: string) =>
      filters.setYear(edge, { target: { value } } as unknown as Event);

    type('to', '2005');
    type('to', '1500');
    type('to', 'abc');
    type('to', '2005.5');
    type('from', '');

    expect(emitted).toHaveBeenCalledTimes(2);
    expect(emitted).toHaveBeenNthCalledWith(1, { from: 1990, to: 2005 });
    expect(emitted).toHaveBeenNthCalledWith(2, { from: null, to: null });
  });

  it('toggles a decade on and off', () => {
    const emitted = vi.fn();
    const decade = { from: 1990, to: 1999 } as never;
    const off = render();
    off.yearsChanged.subscribe(emitted);
    off.pickDecade(decade);
    TestBed.resetTestingModule();

    const on = render({ from: 1990, to: 1999 });
    on.yearsChanged.subscribe(emitted);
    on.pickDecade(decade);

    expect(emitted).toHaveBeenNthCalledWith(1, { from: 1990, to: 1999 });
    expect(emitted).toHaveBeenNthCalledWith(2, { from: null, to: null });
  });

  it('offers streaming only for screen types, and platforms only for games', () => {
    streaming.set([{ id: 's', label: 'S' }]);
    const all = render();
    expect(all.showStreaming()).toBe(true);
    expect(all.showPlatforms()).toBe(true);
    TestBed.resetTestingModule();

    const anime = render({ type: 'anime' });
    expect(anime.showStreaming()).toBe(false);
    expect(anime.showPlatforms()).toBe(false);
    streaming.set([]);
  });

  it('loads catalog options only once a type is chosen', async () => {
    const none = render();
    expect(catalogOptions).not.toHaveBeenCalled();
    expect(none.catalogLoading()).toBe(false);
    TestBed.resetTestingModule();

    const typed = render({ type: 'movie' });
    await vi.waitFor(() => expect(typed.catalogOptions()).toHaveLength(1));
    expect(catalogOptions).toHaveBeenCalledWith('movie', '');
    expect(typed.catalogLoading()).toBe(false);
  });

  it('stops loading when the catalog fails', async () => {
    const filters = render(
      { type: 'movie' },
      throwError(() => new Error('boom')),
    );

    await vi.waitFor(() => expect(catalogOptions).toHaveBeenCalled());
    expect(filters.catalogLoading()).toBe(false);
    expect(filters.catalogOptions()).toEqual([]);
  });

  it('prefixes an excluded criterion for screen readers', () => {
    const filters = render({ without: [crit('horror')] });

    expect(filters.ariaLabel(crit('horror'))).toBe('explore.without horror');
    expect(filters.ariaLabel(crit('drama'))).toBe('drama');
  });

  it('tints an included tile like a selected filter, and strikes an excluded one through', () => {
    const filters = render();

    expect(filters.rowClass('include')).toContain('before:bg-accent');
    expect(filters.rowClass('exclude')).toContain('line-through');
    expect(filters.rowClass('off')).toContain('text-text-muted');
  });

  it('opens genres by default and any other section that holds an active criterion', () => {
    const filters = render({ from: 1990 });

    expect(filters.isOpen('genre')).toBe(true);
    expect(filters.isOpen('period')).toBe(true);
    expect(filters.isOpen('theme')).toBe(false);
  });

  it('lets a section be folded or unfolded by hand', () => {
    const filters = render();

    filters.toggle('genre');
    filters.toggle('theme');

    expect(filters.isOpen('genre')).toBe(false);
    expect(filters.isOpen('theme')).toBe(true);
  });

  it('shows every facet by default and only the requested one otherwise', () => {
    expect(render().show('theme')).toBe(true);
    TestBed.resetTestingModule();

    const genreOnly = render({}, of([]), 'genre');
    expect(genreOnly.show('genre')).toBe(true);
    expect(genreOnly.show('theme')).toBe(false);
  });
});
