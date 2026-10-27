import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { vi, type Mock } from 'vitest';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { DiscoverService } from '@app/core/services/discover/discover';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { artKey, type HomeArt, type HomeArtResolver } from './home-art';
import { createHomeDiscovery, groupSoon, interleave, pickFeatured } from './home-discovery';

const TODAY = '2026-10-25';
const ART: HomeArt = { full: 'full', wide: 'wide', card: 'card', thumb: 'thumb' };

const item = (id: string, releaseDate: string | null, cover = true): CollectionItemResponse =>
  ({
    id,
    media: {
      provider: 'tmdb',
      mediaType: 'movie',
      externalId: id,
      title: id,
      coverUrl: cover ? `${id}.jpg` : null,
      metadata: releaseDate ? { releaseDate } : {},
    },
  }) as unknown as CollectionItemResponse;

const movie = (id: number, date: string) => ({
  id,
  title: `Movie ${id}`,
  overview: '',
  posterPath: `/p${id}`,
  backdropPath: `/b${id}`,
  releaseDate: date,
  genreIds: [],
  voteAverage: 7,
});

const show = (id: number, date: string) => ({
  id,
  name: `Show ${id}`,
  overview: '',
  posterPath: `/s${id}`,
  backdropPath: `/sb${id}`,
  firstAirDate: date,
  genreIds: [],
  voteAverage: 7,
});

const anime = (id: number, date: string) => ({
  id,
  title: `Anime ${id}`,
  summary: '',
  releaseDate: date,
  coverImageUrl: `anime${id}.jpg`,
  genres: [],
  rating: 80,
  popularity: 1,
  episodes: 12,
  status: 'RELEASING',
  bannerImageUrl: null,
});

const page = (content: unknown[]) => of({ content, page: 0, size: 20, totalElements: 0 });

describe('interleave', () => {
  it('alternates lists and keeps the tail of the longest one', () => {
    expect(interleave<number | string | boolean>([[1, 2, 3], ['a'], [true, false]])).toEqual([
      1,
      'a',
      true,
      2,
      false,
      3,
    ]);
  });
});

describe('groupSoon', () => {
  it('groups dated releases by day, two per day, within the window and without exclusions', () => {
    const items = [
      item('past', '2026-10-24'),
      item('today', TODAY),
      item('a', '2026-10-27'),
      item('b', '2026-10-27'),
      item('c', '2026-10-27'),
      item('excluded', '2026-10-28'),
      item('d', '2026-10-28'),
      item('far', '2027-02-01'),
      item('blank', '2026-10-29', false),
    ];

    const days = groupSoon(items, TODAY, new Set([artKey(items[5])]));

    expect(days).toEqual([
      { date: '2026-10-27', items: [items[2], items[3]] },
      { date: '2026-10-28', items: [items[6]] },
    ]);
  });

  it('keeps nine days at most', () => {
    const items = Array.from({ length: 12 }, (_, index) =>
      item(`d${index}`, `2026-11-${String(index + 1).padStart(2, '0')}`),
    );

    expect(groupSoon(items, TODAY, new Set())).toHaveLength(9);
  });
});

describe('pickFeatured', () => {
  const slide = (id: string, art: HomeArt | null) => ({ item: item(id, null), art });

  it('draws among the titles with artwork, or among covers when none has any', () => {
    expect(
      pickFeatured([slide('a', null), slide('b', ART), slide('c', ART)], () => 0.99)?.item.id,
    ).toBe('c');
    expect(pickFeatured([slide('a', null), slide('b', null)], () => 0.6)?.item.id).toBe('b');
    expect(pickFeatured([])).toBeNull();
  });
});

describe('createHomeDiscovery', () => {
  let discover: Record<string, ReturnType<typeof vi.fn>>;
  let art: Mock<HomeArtResolver>;

  function create() {
    return TestBed.runInInjectionContext(() =>
      createHomeDiscovery({
        discover: discover as unknown as DiscoverService,
        tmdb: { imageUrl: (path: string | null) => path } as unknown as TmdbService,
        igdb: { imageUrl: () => null } as unknown as IgdbService,
        art,
        today: () => TODAY,
        random: () => 0,
      }),
    );
  }

  beforeEach(() => {
    discover = {
      getMovies: vi.fn((feed: string) =>
        feed === 'upcoming'
          ? page([movie(10, '2026-11-19'), movie(11, '2026-10-27'), movie(12, '2026-10-20')])
          : feed === 'new'
            ? page([movie(20, '2026-10-01'), movie(21, '2026-10-20'), movie(22, '2026-11-01')])
            : feed === 'top_rated'
              ? page([movie(1, '1999-01-01'), movie(50, '1994-01-01')])
              : page([1, 2, 3, 4, 5, 6, 7].map((id) => movie(id, '2026-01-01'))),
      ),
      getSeries: vi.fn((feed: string) =>
        feed === 'trending' ? page([show(30, '2026-01-01')]) : page([]),
      ),
      getGames: vi.fn(() => page([])),
      getAnime: vi.fn((feed: string) =>
        feed === 'trending' ? page([anime(40, '2026-01-01')]) : page([]),
      ),
      getManga: vi.fn(() => page([])),
      getWebtoons: vi.fn(() => page([])),
    };
    art = vi.fn<HomeArtResolver>((value) => of(value.media.externalId === '2' ? null : ART));
  });

  it('builds every discovery section for all media without repeating titles', () => {
    const home = create();

    home.select('all');
    const view = home.view()!;

    expect(view.filter).toBe('all');
    expect(view.featured?.item.media.title).toBe('Movie 1');
    expect(view.featured?.art).toBe(ART);
    expect(view.anticipated.map((slide) => slide.item.media.title)).toEqual([
      'Movie 10',
      'Movie 11',
    ]);
    expect(view.top[0].media.title).toBe('Movie 1');
    expect(view.soon).toEqual([]);
    expect(view.released.map((entry) => entry.media.title)).toEqual(['Movie 21', 'Movie 20']);
    expect(view.wall).toEqual([]);
    expect(view.rated.map((entry) => entry.media.title)).toEqual(['Movie 50']);
  });

  it('features a cover title with a banner when one has it', () => {
    discover['getAnime'] = vi.fn((feed: string) =>
      feed === 'trending' ? page([40, 41, 42].map((id) => anime(id, '2026-01-01'))) : page([]),
    );
    art.mockImplementation((value) => of(value.id === 'anime-42' ? ART : null));
    const home = create();

    home.select('anime');

    expect(home.view()!.featured).toEqual({
      item: expect.objectContaining({ id: 'anime-42' }),
      art: ART,
    });
    expect(home.view()!.anticipated).toEqual([]);
    expect(home.view()!.wall).toEqual(['anime40.jpg', 'anime41.jpg', 'anime42.jpg']);
  });

  it('resolves art only for the stage titles it needs', () => {
    discover['getMovies'] = vi.fn((feed: string) =>
      feed === 'trending'
        ? page(Array.from({ length: 12 }, (_, index) => movie(index + 1, '2026-01-01')))
        : page([]),
    );
    art.mockImplementation(() => of(ART));
    const home = create();

    home.select('movie');

    expect(art.mock.calls.map(([value]) => value.media.externalId)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
    ]);
    expect(home.view()!.pending).toBe(false);
  });

  it('shows the stage before the other feeds arrive', () => {
    const upcoming = new Subject<{
      content: unknown[];
      page: number;
      size: number;
      totalElements: number;
    }>();
    discover['getMovies'] = vi.fn((feed: string) =>
      feed === 'upcoming' ? upcoming : page([1, 2, 3].map((id) => movie(id, '2026-01-01'))),
    );
    const home = create();

    home.select('movie');

    expect(home.view()!.featured?.item.media.title).toBe('Movie 1');
    expect(home.view()!.pending).toBe(true);
    expect(home.view()!.top).toEqual([]);
    expect(home.loading()).toBe(true);

    upcoming.next({ content: [movie(10, '2026-11-19')], page: 0, size: 20, totalElements: 1 });
    upcoming.complete();

    expect(home.view()!.pending).toBe(false);
    expect(home.view()!.featured?.item.media.title).toBe('Movie 1');
    expect(home.view()!.anticipated.map((slide) => slide.item.media.title)).toEqual(['Movie 10']);
    expect(home.loading()).toBe(false);
  });

  it('reuses loaded feeds when a filter comes back', () => {
    const home = create();

    home.select('movie');
    home.select('tv_show');
    home.select('movie');

    expect(discover['getMovies']).toHaveBeenCalledTimes(4);
    expect(home.view()!.filter).toBe('movie');
  });
});
