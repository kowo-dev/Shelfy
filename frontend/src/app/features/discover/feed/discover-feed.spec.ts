import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';
import { AddSheetService } from '@app/core/services/add-sheet/add-sheet';
import { DiscoverService } from '@app/core/services/discover/discover';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { ShelfLookupService } from '@app/core/services/shelf-lookup/shelf-lookup';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { TranslateService } from '@app/core/services/translate/translate';
import { DiscoverFeedPageComponent } from './discover-feed';

const movie = (id: number, releaseDate: string) => ({
  id,
  title: `Movie ${id}`,
  overview: '',
  posterPath: `/p${id}`,
  backdropPath: null,
  releaseDate,
  genreIds: [],
  voteAverage: 7,
});

describe('DiscoverFeedPageComponent', () => {
  const page = (content: unknown[]) => of({ content, page: 0, size: 200, totalElements: 0 });
  let discover: Record<string, ReturnType<typeof vi.fn>>;
  let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    discover = {
      getMovies: vi.fn(() => page([movie(1, '2026-12-01'), movie(2, '2026-11-01')])),
      getSeries: vi.fn(() => page([])),
      getGames: vi.fn(() => page([])),
      getAnime: vi.fn(() => page([])),
      getManga: vi.fn(() => page([])),
      getWebtoons: vi.fn(() => page([])),
    };
    query = new BehaviorSubject(convertToParamMap({ type: 'movie' }));
    TestBed.configureTestingModule({
      imports: [DiscoverFeedPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ feed: 'soon' })),
            queryParamMap: query,
            snapshot: {
              paramMap: convertToParamMap({ feed: 'soon' }),
              queryParamMap: convertToParamMap({ type: 'movie' }),
            },
          },
        },
        { provide: DiscoverService, useValue: discover },
        { provide: TmdbService, useValue: { imageUrl: (path: string | null) => path } },
        { provide: IgdbService, useValue: { imageUrl: () => null } },
        { provide: ShelfLookupService, useValue: { find: () => null, request: vi.fn() } },
        { provide: AddSheetService, useValue: { open: vi.fn() } },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
  });

  it('lists the whole feed of the chosen medium, soonest first', () => {
    const fixture = TestBed.createComponent(DiscoverFeedPageComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;

    expect(discover['getMovies']).toHaveBeenCalledWith('upcoming', 0, 200);
    expect(page.title()).toBe('home.feed.soon');
    expect(page.items().map((item) => item.media.title)).toEqual(['Movie 2', 'Movie 1']);
    expect(fixture.nativeElement.querySelectorAll('shelfy-media-card')).toHaveLength(2);
  });

  it('reloads when the medium changes', () => {
    const fixture = TestBed.createComponent(DiscoverFeedPageComponent);
    fixture.detectChanges();

    query.next(convertToParamMap({ type: 'tv_show' }));
    fixture.detectChanges();

    expect(discover['getSeries']).toHaveBeenCalledWith('upcoming', 0, 200);
    expect(fixture.componentInstance.filter()).toBe('tv_show');
  });
});
