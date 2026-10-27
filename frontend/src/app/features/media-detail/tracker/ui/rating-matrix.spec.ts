import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { TranslateService } from '@app/core/services/translate/translate';
import type { EpisodeCell, SeasonColumn } from '../episode-grid.util';
import { heatColor } from '../episode-grid.util';
import { RatingMatrixComponent } from './rating-matrix';

function cell(season: number, episode: number, overrides: Partial<EpisodeCell> = {}): EpisodeCell {
  return {
    season,
    episode,
    title: null,
    overview: null,
    stillPath: null,
    airDate: '2020-01-01',
    runtime: null,
    released: true,
    watched: false,
    mine: null,
    community: null,
    tmdb: null,
    friends: [],
    ...overrides,
  };
}

function column(
  season: number,
  episodes: EpisodeCell[],
  mine: number | null = null,
  tmdb: number | null = null,
): SeasonColumn {
  return {
    season,
    name: null,
    episodes,
    watched: episodes.filter((e) => e.watched).length,
    released: episodes.filter((e) => e.released).length,
    averages: { mine, community: null, tmdb },
  };
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('RatingMatrixComponent', () => {
  function render(
    columns: SeasonColumn[],
    selectedSeason: number | null = null,
    width = 0,
    orientation: 'vertical' | 'horizontal' = 'vertical',
  ) {
    TestBed.configureTestingModule({
      imports: [RatingMatrixComponent],
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
        { provide: TmdbService, useValue: { imageUrl: (p: string | null) => p && `img:${p}` } },
        { provide: DateFormatService, useValue: { formatDate: () => 'Jan 1, 2020' } },
      ],
    });
    const fixture = TestBed.createComponent(RatingMatrixComponent);
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('source', 'tmdb');
    fixture.componentRef.setInput('selectedSeason', selectedSeason);
    fixture.componentRef.setInput('orientation', orientation);
    Object.defineProperty(fixture.nativeElement, 'clientWidth', { value: width });
    fixture.detectChanges();
    fixture.detectChanges();
    return fixture;
  }

  const cells = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>('[data-cell]')];

  it('shows my rating when I rated the episode and the external average otherwise', () => {
    const el: HTMLElement = render([
      column(1, [
        cell(1, 1, { mine: 9, tmdb: { average: 6, votes: 10 } }),
        cell(1, 2, { tmdb: { average: 7, votes: 10 } }),
        cell(1, 3),
      ]),
    ]).nativeElement;

    expect(cells(el).map((c) => c.textContent?.trim())).toEqual(['4.5', '3.5', '']);
  });

  it('fills my watched rating and only tints it before I watch, flagging watched', () => {
    const el: HTMLElement = render([
      column(1, [cell(1, 1, { mine: 9, watched: true }), cell(1, 2, { mine: 9 })]),
    ]).nativeElement;
    const [watched, unwatched] = cells(el);

    expect(watched.style.backgroundColor).toBe('var(--color-rating-high)');
    expect(watched.style.color).toBe('var(--color-background)');
    expect(unwatched.style.backgroundColor).toContain('30%');
    expect(watched.hasAttribute('data-watched')).toBe(true);
    expect(unwatched.hasAttribute('data-watched')).toBe(false);
  });

  it('tints external scores along the heat scale, brighter once watched', () => {
    const el: HTMLElement = render([
      column(1, [
        cell(1, 1, { tmdb: { average: 7.25, votes: 10 }, watched: true }),
        cell(1, 2, { tmdb: { average: 7.25, votes: 10 } }),
        cell(1, 3),
      ]),
    ]).nativeElement;
    const [watched, unwatched, unrated] = cells(el);

    expect(watched.style.color).toContain('--color-rating-mid) 50%');
    expect(watched.style.backgroundColor).toContain('24%');
    expect(unwatched.style.backgroundColor).toContain('10%');
    expect(unrated.style.backgroundColor).toBe('rgba(255, 255, 255, 0.04)');
  });

  const pointer = (type: string, pointerType: string) =>
    Object.assign(new Event(type), { pointerType });

  it('previews the hovered episode with its still, title and score, and hides it on leave', () => {
    const fixture = render([
      column(1, [
        cell(1, 1, {
          title: 'Pilot',
          stillPath: '/p.jpg',
          watched: true,
          runtime: 50,
          tmdb: { average: 8, votes: 10 },
        }),
      ]),
    ]);
    const el: HTMLElement = fixture.nativeElement;
    const [first] = cells(el);

    first.dispatchEvent(pointer('pointerenter', 'mouse'));
    fixture.detectChanges();
    const tip = el.querySelector('[role="tooltip"]');
    expect(tip?.querySelector('img')?.getAttribute('src')).toBe('img:/p.jpg');
    expect(tip?.textContent).toContain('Pilot');
    expect(tip?.textContent).toContain('4');
    expect(tip?.textContent).toContain('media.tracker.watched');

    first.dispatchEvent(pointer('pointerleave', 'mouse'));
    fixture.detectChanges();
    expect(el.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('keeps the preview for the mouse, not touch', () => {
    const fixture = render([column(1, [cell(1, 1)])]);
    const el: HTMLElement = fixture.nativeElement;

    cells(el)[0].dispatchEvent(pointer('pointerenter', 'touch'));
    fixture.detectChanges();

    expect(el.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('runs the heat scale from red to teal', () => {
    expect(heatColor(4)).toBe('var(--color-rating-low)');
    expect(heatColor(9.5)).toBe('var(--color-rating-high)');
    expect(heatColor(8.5)).toBe(
      'color-mix(in oklch, var(--color-rating-good) 50%, var(--color-rating-high))',
    );
  });

  it('labels one column per season and one row per episode number', () => {
    const el: HTMLElement = render([
      column(1, [cell(1, 1), cell(1, 2)]),
      column(2, [cell(2, 1), cell(2, 2), cell(2, 3)]),
    ]).nativeElement;

    expect(el.textContent).toContain('E3');
    expect(el.querySelectorAll('button[aria-pressed]')).toHaveLength(2);
    expect(el.textContent).toContain('media.tracker.season_short');
  });

  it('leaves an episode that has not aired out of reach', () => {
    const el: HTMLElement = render([
      column(1, [cell(1, 1, { released: false }), cell(1, 2)]),
    ]).nativeElement;

    expect(cells(el)).toHaveLength(1);
  });

  it('shows the season average, mine before the external one', () => {
    const el: HTMLElement = render([
      column(1, [cell(1, 1)], 8),
      column(2, [cell(2, 1)], null, 7),
      column(3, [cell(3, 1)]),
    ]).nativeElement;
    const heads = [...el.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')];

    expect(heads.map((h) => h.querySelector('shelfy-rating-value')?.textContent?.trim())).toEqual([
      '4',
      '3.5',
      undefined,
    ]);
    expect(heads[2].textContent).toContain('–');
  });

  it('highlights the selected season and reports season and cell clicks', () => {
    const fixture = render([column(1, [cell(1, 1)]), column(2, [cell(2, 1)])], 2);
    const seasons = vi.fn();
    const picked = vi.fn();
    fixture.componentInstance.seasonSelected.subscribe(seasons);
    fixture.componentInstance.cellSelected.subscribe(picked);
    const el: HTMLElement = fixture.nativeElement;
    const heads = el.querySelectorAll<HTMLButtonElement>('button[aria-pressed]');

    expect(heads[0].getAttribute('aria-pressed')).toBe('false');
    expect(heads[1].getAttribute('aria-pressed')).toBe('true');
    heads[0].click();
    cells(el)[1].click();

    expect(seasons).toHaveBeenCalledWith(1);
    expect(picked).toHaveBeenCalledWith(expect.objectContaining({ season: 2, episode: 1 }));
  });

  const seasons = (count: number) =>
    Array.from({ length: count }, (_, i) => column(i + 1, [cell(i + 1, 1), cell(i + 1, 2)]));
  const heads = (el: HTMLElement) =>
    [...el.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].map(
      (h) => h.dataset['season'],
    );
  const arrows = (el: HTMLElement) => [
    ...el.querySelectorAll<HTMLButtonElement>('button:not([aria-pressed]):not([data-cell])'),
  ];

  it('keeps one season a single fixed-width column', () => {
    const fixture = render(seasons(1), null, 700);

    expect(fixture.componentInstance.template()).toBe('40px repeat(1, 88px)');
    expect(arrows(fixture.nativeElement)).toHaveLength(0);
  });

  it('shows every season without arrows when they all fit', () => {
    const fixture = render(seasons(5), null, 700);

    expect(heads(fixture.nativeElement)).toEqual(['1', '2', '3', '4', '5']);
    expect(arrows(fixture.nativeElement)).toHaveLength(0);
  });

  it('shows only the seasons that fit and pages through the rest with arrows', () => {
    const fixture = render(seasons(5), 1, 400);
    const el: HTMLElement = fixture.nativeElement;

    expect(heads(el)).toEqual(['1', '2', '3']);
    expect(el.textContent).toContain('E2');
    let [previous, next] = arrows(el);
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    next.click();
    fixture.detectChanges();
    expect(heads(el)).toEqual(['3', '4', '5']);
    [previous, next] = arrows(el);
    expect(previous.disabled).toBe(false);
    expect(next.disabled).toBe(true);

    previous.click();
    fixture.detectChanges();
    expect(heads(el)).toEqual(['1', '2', '3']);
  });

  it('brings the selected season into view', () => {
    const el: HTMLElement = render(seasons(5), 5, 400).nativeElement;

    expect(heads(el)).toEqual(['3', '4', '5']);
  });

  describe('horizontal', () => {
    const episodes = (season: number, count: number) =>
      column(
        season,
        Array.from({ length: count }, (_, i) => cell(season, i + 1, { mine: 8 })),
        8,
      );
    const numbers = (el: HTMLElement) =>
      [...el.querySelectorAll('span')]
        .map((e) => e.textContent?.trim() ?? '')
        .filter((t) => /^E[0-9]+$/.test(t));

    it('puts one season per row with fixed-width episode columns', () => {
      const fixture = render([episodes(1, 3), episodes(2, 2)], null, 1000, 'horizontal');
      const el: HTMLElement = fixture.nativeElement;

      expect(fixture.componentInstance.template()).toBe('112px repeat(3, 60px)');
      expect(numbers(el)).toEqual(['E1', 'E2', 'E3']);
      expect(heads(el)).toEqual(['1', '2']);
      expect(cells(el)).toHaveLength(5);
      expect(arrows(el)).toHaveLength(0);
    });

    it('shows my rating before the external average in the same cells', () => {
      const el: HTMLElement = render(
        [column(1, [cell(1, 1, { mine: 9 }), cell(1, 2, { tmdb: { average: 7, votes: 5 } })])],
        null,
        1000,
        'horizontal',
      ).nativeElement;

      expect(cells(el).map((c) => c.textContent?.trim())).toEqual(['4.5', '3.5']);
    });

    it('pages through the episode columns while every season row stays', () => {
      const fixture = render([episodes(1, 10), episodes(2, 4)], null, 460, 'horizontal');
      const el: HTMLElement = fixture.nativeElement;

      expect(numbers(el)).toEqual(['E1', 'E2', 'E3', 'E4', 'E5']);
      expect(heads(el)).toEqual(['1', '2']);
      const [previous, next] = arrows(el);
      expect(previous.disabled).toBe(true);
      next.click();
      fixture.detectChanges();
      expect(numbers(el)).toEqual(['E6', 'E7', 'E8', 'E9', 'E10']);
      expect(heads(el)).toEqual(['1', '2']);
      expect(arrows(el)[1].disabled).toBe(true);
    });

    it('reports cell and season clicks', () => {
      const fixture = render([episodes(1, 2)], null, 1000, 'horizontal');
      const picked = vi.fn();
      const chosen = vi.fn();
      fixture.componentInstance.cellSelected.subscribe(picked);
      fixture.componentInstance.seasonSelected.subscribe(chosen);

      cells(fixture.nativeElement)[1].click();
      fixture.nativeElement.querySelector('button[aria-pressed]').click();

      expect(picked).toHaveBeenCalledWith(expect.objectContaining({ season: 1, episode: 2 }));
      expect(chosen).toHaveBeenCalledWith(1);
    });
  });
});
