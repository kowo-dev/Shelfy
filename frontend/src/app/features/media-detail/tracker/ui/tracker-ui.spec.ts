import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RatingSliderComponent } from '@shared/ui/rating-slider/rating-slider';
import { vi } from 'vitest';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { TranslateService } from '@app/core/services/translate/translate';
import type { EpisodeCell, RatingSource, SeasonColumn } from '../episode-grid.util';
import { EpisodeRowComponent } from './episode-row';
import { SeasonListComponent } from './season-list';

function cell(episode: number, overrides: Partial<EpisodeCell> = {}): EpisodeCell {
  return {
    season: 1,
    episode,
    title: `Episode ${episode}`,
    overview: null,
    stillPath: null,
    airDate: '2020-01-01',
    runtime: 45,
    released: true,
    watched: false,
    mine: null,
    community: null,
    tmdb: null,
    friends: [],
    ...overrides,
  };
}

function column(episodes: EpisodeCell[]): SeasonColumn {
  return {
    season: 1,
    name: null,
    episodes,
    watched: episodes.filter((e) => e.watched).length,
    released: episodes.filter((e) => e.released).length,
    averages: { mine: 8, community: null, tmdb: null },
  };
}

const providers = [
  { provide: TmdbService, useValue: { imageUrl: (path: string | null) => path && `img:${path}` } },
  {
    provide: TranslateService,
    useValue: { get: (key: string) => key, lang: () => 'en' },
  },
];

const toggleOf = (el: HTMLElement) =>
  el.querySelector<HTMLButtonElement>('button[aria-pressed]') as HTMLButtonElement;
const halvesOf = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('[role=slider]')];

describe('EpisodeRowComponent', () => {
  function render(
    episode: EpisodeCell,
    options: { source?: RatingSource; editable?: boolean } = {},
  ) {
    TestBed.configureTestingModule({ imports: [EpisodeRowComponent], providers });
    const fixture = TestBed.createComponent(EpisodeRowComponent);
    fixture.componentRef.setInput('cell', episode);
    fixture.componentRef.setInput('source', options.source ?? 'tmdb');
    fixture.componentRef.setInput('editable', options.editable ?? true);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the still when there is one, and the episode number otherwise', () => {
    const withStill = render(cell(3, { stillPath: '/s.jpg' }));
    expect(withStill.nativeElement.querySelector('img')?.getAttribute('src')).toBe('img:/s.jpg');
    TestBed.resetTestingModule();

    const without = render(cell(3));
    expect(without.nativeElement.querySelector('img')).toBeNull();
    expect(without.nativeElement.textContent).toContain('3');
  });

  it('shows the episode number, title and the external score with its source', () => {
    const el: HTMLElement = render(cell(2, { tmdb: { average: 8.6, votes: 40 } })).nativeElement;

    expect(el.querySelector('.caption b')?.textContent?.replace(/\s+/g, ' ')).toContain(
      'E2 · Episode 2',
    );
    expect(el.querySelector('shelfy-rating-value')?.textContent?.trim()).toMatch(/^4\.3\s*TMDB$/);
  });

  it('shows no external score when the source has none', () => {
    expect(render(cell(1)).nativeElement.querySelector('shelfy-rating-value')).toBeNull();
  });

  it('opens the episode from the image', () => {
    const fixture = render(cell(1));
    const opened = vi.fn();
    fixture.componentInstance.opened.subscribe(opened);

    fixture.nativeElement.querySelector('button').click();

    expect(opened).toHaveBeenCalled();
  });

  it('toggles watched from a round button that reflects the state', () => {
    const fixture = render(cell(1));
    const toggled = vi.fn();
    fixture.componentInstance.watchedToggled.subscribe(toggled);

    expect(toggleOf(fixture.nativeElement).getAttribute('aria-pressed')).toBe('false');
    toggleOf(fixture.nativeElement).click();
    expect(toggled).toHaveBeenLastCalledWith(true);
    TestBed.resetTestingModule();

    const watched = render(cell(1, { watched: true }));
    watched.componentInstance.watchedToggled.subscribe(toggled);
    expect(toggleOf(watched.nativeElement).getAttribute('aria-pressed')).toBe('true');
    expect(toggleOf(watched.nativeElement).classList).toContain('is-done');
    toggleOf(watched.nativeElement).click();
    expect(toggled).toHaveBeenLastCalledWith(false);
  });

  it('rates the episode from the rating slider and clears it', () => {
    const fixture = render(cell(1, { mine: 6 }));
    const rated = vi.fn();
    fixture.componentInstance.rated.subscribe(rated);
    const slider = fixture.debugElement.query(By.directive(RatingSliderComponent))
      .componentInstance as RatingSliderComponent;

    expect(slider.value()).toBe(6);
    expect(fixture.nativeElement.textContent).toContain('3');
    slider.changed.emit(7);
    expect(rated).toHaveBeenLastCalledWith(7);
    slider.changed.emit(null);
    expect(rated).toHaveBeenLastCalledWith(null);
  });

  it('offers neither toggle nor stars off the shelf or before the episode airs', () => {
    const readOnly = render(cell(1), { editable: false });
    expect(toggleOf(readOnly.nativeElement)).toBeNull();
    expect(halvesOf(readOnly.nativeElement)).toHaveLength(0);
    TestBed.resetTestingModule();

    const unaired = render(cell(1, { released: false }));
    expect(toggleOf(unaired.nativeElement)).toBeNull();
    expect(halvesOf(unaired.nativeElement)).toHaveLength(0);
    expect(unaired.nativeElement.textContent).toContain('media.tracker.not_aired');
  });

  it('outlines a highlighted episode', () => {
    const fixture = render(cell(1));
    expect(fixture.nativeElement.querySelector('.outline-accent')).toBeNull();

    fixture.componentRef.setInput('highlighted', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.outline-accent')).not.toBeNull();
  });

  it('describes the still with number, title, shown score and state', () => {
    const { componentInstance: tile } = render(cell(2, { mine: 8, watched: true }));

    expect(tile.label()).toBe('S1E2 · Episode 2 · 4 · media.tracker.watched');
  });
});

describe('SeasonListComponent', () => {
  function render(season: SeasonColumn, editable = true) {
    TestBed.configureTestingModule({ imports: [SeasonListComponent], providers });
    const fixture = TestBed.createComponent(SeasonListComponent);
    fixture.componentRef.setInput('season', season);
    fixture.componentRef.setInput('source', 'tmdb');
    fixture.componentRef.setInput('editable', editable);
    fixture.detectChanges();
    return fixture;
  }

  const scrolled = vi.fn();

  beforeEach(() => {
    scrolled.mockReset();
    HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) {
      scrolled(this.getAttribute('data-episode'));
    };
  });

  afterEach(() => Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView'));

  const seasonToggle = (el: HTMLElement) => el.querySelector('.flex-wrap > [aria-pressed]');

  it('opens an aired episode but not one that has not aired', () => {
    const fixture = render(column([cell(1), cell(2, { released: false })]));
    const selected = vi.fn();
    fixture.componentInstance.episodeSelected.subscribe(selected);

    fixture.componentInstance.open(cell(2, { released: false }));
    expect(selected).not.toHaveBeenCalled();

    fixture.componentInstance.open(cell(1));
    expect(selected).toHaveBeenCalledWith(expect.objectContaining({ episode: 1 }));
  });

  it('renders one row per episode and forwards watched and rating changes', () => {
    const fixture = render(column([cell(1), cell(2)]));
    const el: HTMLElement = fixture.nativeElement;
    const watched = vi.fn();
    const rated = vi.fn();
    fixture.componentInstance.watchedToggled.subscribe(watched);
    fixture.componentInstance.rated.subscribe(rated);

    const tiles = el.querySelectorAll<HTMLElement>('shelfy-episode-row');
    expect(tiles).toHaveLength(2);
    toggleOf(tiles[1]).click();
    (
      fixture.debugElement.queryAll(By.directive(RatingSliderComponent))[0]
        .componentInstance as RatingSliderComponent
    ).changed.emit(9);

    expect(watched).toHaveBeenCalledWith({
      cell: expect.objectContaining({ episode: 2 }),
      watched: true,
    });
    expect(rated).toHaveBeenCalledWith({
      cell: expect.objectContaining({ episode: 1 }),
      rating: 9,
    });
  });

  it('outlines the highlighted episode only', () => {
    const fixture = render(column([cell(1), cell(2)]));
    fixture.componentRef.setInput('highlighted', 2);
    fixture.detectChanges();

    const outlined = fixture.nativeElement.querySelectorAll('shelfy-episode-row .outline-accent');
    expect(outlined).toHaveLength(1);
    expect(outlined[0].closest('shelfy-episode-row').getAttribute('data-episode')).toBe('2');
  });

  it('scrolls to the highlighted episode', () => {
    const fixture = render(column([cell(1), cell(2)]));
    fixture.componentRef.setInput('highlighted', 2);
    fixture.detectChanges();

    expect(scrolled).toHaveBeenCalledWith('2');
  });

  it('shows the season average out of five with a star', () => {
    const el = render(column([cell(1)])).nativeElement as HTMLElement;
    expect(el.querySelector('shelfy-rating-value')?.textContent?.trim()).toBe('4');
    expect(el.querySelector('shelfy-rating-value shelfy-icon')).not.toBeNull();
  });

  it('shows a dash for a missing average', () => {
    const season = { ...column([cell(1)]), averages: { mine: null, community: null, tmdb: null } };
    const el = render(season).nativeElement as HTMLElement;
    expect(el.querySelector('p shelfy-rating-value')).toBeNull();
    expect(el.querySelector('p')?.textContent).toContain('–');
  });

  it('offers the season toggle only when editable and something has aired', () => {
    expect(seasonToggle(render(column([cell(1)])).nativeElement)).not.toBeNull();
    TestBed.resetTestingModule();

    expect(seasonToggle(render(column([cell(1)]), false).nativeElement)).toBeNull();
  });

  it('marks the toggle pressed once every aired episode is watched', () => {
    const fixture = render(column([cell(1, { watched: true }), cell(2, { released: false })]));

    expect(seasonToggle(fixture.nativeElement)?.getAttribute('aria-pressed')).toBe('true');
  });
});
