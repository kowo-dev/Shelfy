import { BehaviorSubject, NEVER, of } from 'rxjs';
import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { AniListService } from '@app/core/services/anilist/anilist';
import { TranslateService } from '@app/core/services/translate/translate';
import { CollectionService } from '@app/core/services/collection/collection';

import { BrowsePageComponent } from './browse';

describe('BrowsePageComponent', () => {
  let paramMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let queryParamMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let tmdb: {
    getMoviesByGenre: ReturnType<typeof vi.fn>;
    imageUrl: (path: string | null) => string | null;
  };
  let igdb: {
    getGamesByGenre: ReturnType<typeof vi.fn>;
    getGamesByPlatform: ReturnType<typeof vi.fn>;
    imageUrl: (id: string | null) => string | null;
  };
  let anilist: { browseByGenre: ReturnType<typeof vi.fn> };

  function setup(params: Record<string, string>, query: Record<string, string> = {}) {
    paramMap = new BehaviorSubject(convertToParamMap(params));
    queryParamMap = new BehaviorSubject(convertToParamMap(query));

    tmdb = {
      getMoviesByGenre: vi.fn().mockReturnValue(
        of({
          page: 1,
          totalPages: 2,
          totalResults: 40,
          results: [{ id: 1, title: 'Movie A', posterPath: '/a.jpg', voteAverage: 7.5 }],
        }),
      ),
      imageUrl: (path: string | null) => (path ? `https://img${path}` : null),
    };
    igdb = {
      getGamesByGenre: vi.fn().mockReturnValue(
        of({
          content: [{ id: 1, name: 'Game A', coverImageId: 'cover', rating: 80 }],
          hasMore: true,
        }),
      ),
      getGamesByPlatform: vi.fn().mockReturnValue(
        of({
          content: [{ id: 1, name: 'Game A', coverImageId: 'cover', rating: 80 }],
          hasMore: true,
        }),
      ),
      imageUrl: (id: string | null) => (id ? `https://img/${id}` : null),
    };
    anilist = {
      browseByGenre: vi.fn().mockReturnValue(
        of({
          items: [{ id: 1, mediaType: 'anime', title: 'Anime A', coverImageUrl: null, rating: 8 }],
          hasMore: false,
        }),
      ),
    };

    TestBed.configureTestingModule({
      imports: [BrowsePageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap, queryParamMap },
        },
        { provide: TmdbService, useValue: tmdb },
        { provide: IgdbService, useValue: igdb },
        { provide: AniListService, useValue: anilist },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
        {
          provide: CollectionService,
          useValue: { lookupBatch: vi.fn().mockReturnValue(of({})), changes: NEVER },
        },
      ],
    });
  }

  it('loads movies by genre on init', () => {
    setup({ mediaType: 'movie', facet: 'genre', ref: '28' });
    const fixture = TestBed.createComponent(BrowsePageComponent);
    fixture.detectChanges();

    expect(tmdb.getMoviesByGenre).toHaveBeenCalledWith(28, 1);
    const component = fixture.componentInstance;
    expect(component.items().length).toBe(1);
    expect(component.hasMore()).toBe(true);
    expect(component.loading()).toBe(false);
  });

  it('uses the name query param as title when present', () => {
    setup({ mediaType: 'movie', facet: 'genre', ref: '28' }, { name: 'Action' });
    const fixture = TestBed.createComponent(BrowsePageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.title()).toBe('Action');
  });

  it('renders the entity shelf with the media type and title count as hero facts', () => {
    setup({ mediaType: 'movie', facet: 'genre', ref: '28' }, { name: 'Action' });
    const fixture = TestBed.createComponent(BrowsePageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.facts()).toEqual([
      { label: 'collection.media_type.movie' },
      { value: '1+', label: 'entity.title_one' },
    ]);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('shelfy-page-hero h1')?.textContent).toContain('Action');
    expect(el.querySelector('shelfy-entity-media-grid')).not.toBeNull();
  });

  it('does not ask for the same next page twice while it is loading', () => {
    setup({ mediaType: 'movie', facet: 'genre', ref: '28' });
    const fixture = TestBed.createComponent(BrowsePageComponent);
    fixture.detectChanges();
    tmdb.getMoviesByGenre.mockReturnValue(NEVER);

    fixture.componentInstance.loadMore();
    fixture.componentInstance.loadMore();

    expect(tmdb.getMoviesByGenre).toHaveBeenCalledTimes(2);
  });

  it('formats a title from the facet when there is a facet but no ref', () => {
    setup({ mediaType: 'movie', facet: 'genre' });
    const fixture = TestBed.createComponent(BrowsePageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.title()).toBe('Genre movie');
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.items().length).toBe(0);
  });

  it('formats a title from ref when there is no facet', () => {
    setup({ mediaType: 'anime', ref: 'action-adventure' });
    const fixture = TestBed.createComponent(BrowsePageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.title()).toBe('Action adventure');
  });

  it('falls back to Browse title with no ref or facet', () => {
    setup({ mediaType: 'unknown' });
    const fixture = TestBed.createComponent(BrowsePageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.title()).toBe('Browse');
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.items().length).toBe(0);
  });

  it('loads games by genre', () => {
    setup({ mediaType: 'game', facet: 'genre', ref: '5' });
    const fixture = TestBed.createComponent(BrowsePageComponent);
    fixture.detectChanges();

    expect(igdb.getGamesByGenre).toHaveBeenCalledWith(5, 0);
    expect(fixture.componentInstance.items().length).toBe(1);
  });

  it('loads anime by genre', () => {
    setup({ mediaType: 'anime', facet: 'genre', ref: 'action' });
    const fixture = TestBed.createComponent(BrowsePageComponent);
    fixture.detectChanges();

    expect(anilist.browseByGenre).toHaveBeenCalledWith('anime', 'action', 1);
    expect(fixture.componentInstance.items().length).toBe(1);
  });

  it('sets loading false on error', () => {
    setup({ mediaType: 'movie', facet: 'genre', ref: '28' });
    tmdb.getMoviesByGenre.mockReturnValue({
      subscribe: ({ error }: { next: unknown; error: () => void }) => error(),
    });
    const fixture = TestBed.createComponent(BrowsePageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('loadMore appends the next page of movies', () => {
    setup({ mediaType: 'movie', facet: 'genre', ref: '28' });
    const fixture = TestBed.createComponent(BrowsePageComponent);
    fixture.detectChanges();

    tmdb.getMoviesByGenre.mockReturnValue(
      of({
        page: 2,
        totalPages: 2,
        totalResults: 40,
        results: [{ id: 2, title: 'Movie B', posterPath: null, voteAverage: 6 }],
      }),
    );
    fixture.componentInstance.loadMore();

    expect(tmdb.getMoviesByGenre).toHaveBeenCalledWith(28, 2);
    expect(fixture.componentInstance.items().length).toBe(2);
    expect(fixture.componentInstance.hasMore()).toBe(false);
  });

  it('loadMore appends games for the platform facet', () => {
    setup({ mediaType: 'game', facet: 'platform', ref: '5' });
    const fixture = TestBed.createComponent(BrowsePageComponent);
    fixture.detectChanges();

    igdb.getGamesByPlatform.mockReturnValue(
      of({ content: [{ id: 2, name: 'Game B', coverImageId: null, rating: 50 }], hasMore: false }),
    );
    fixture.componentInstance.loadMore();

    expect(igdb.getGamesByPlatform).toHaveBeenCalledWith(5, 1);
    expect(fixture.componentInstance.items().length).toBe(2);
  });

  it('navigates to the media detail page when an item is selected', () => {
    setup({ mediaType: 'movie', facet: 'genre', ref: '28' });
    const fixture = TestBed.createComponent(BrowsePageComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.componentInstance.goToMedia({
      media: { mediaType: 'movie', externalId: '1' },
    } as never);

    expect(navigateSpy).toHaveBeenCalledWith(['/media', 'movie', '1']);
  });
});
