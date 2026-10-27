import { BehaviorSubject, NEVER, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { TranslateService } from '@app/core/services/translate/translate';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { AniListService } from '@app/core/services/anilist/anilist';
import { CollectionService } from '@app/core/services/collection/collection';
import { EntityPageComponent } from './entity-page';

describe('EntityPageComponent - networks', () => {
  let paramMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let data: BehaviorSubject<Record<string, unknown>>;
  let getNetwork: ReturnType<typeof vi.fn>;
  let getNetworkTv: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    paramMap = new BehaviorSubject(convertToParamMap({ id: '213' }));
    data = new BehaviorSubject<Record<string, unknown>>({ entityKind: 'networks' });
    getNetwork = vi.fn().mockReturnValue(
      of({
        id: 213,
        name: 'Netflix',
        description: 'Streaming service',
        headquarters: 'Los Gatos, California',
        originCountry: 'US',
      }),
    );
    getNetworkTv = vi.fn().mockReturnValue(
      of({
        page: 1,
        totalPages: 2,
        totalResults: 40,
        results: [
          {
            id: 66732,
            name: 'Stranger Things',
            posterPath: '/stranger.jpg',
            voteAverage: 8.6,
          },
        ],
      }),
    );

    TestBed.configureTestingModule({
      imports: [EntityPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap,
            data,
            snapshot: { paramMap: paramMap.value, data: data.value },
          },
        },
        {
          provide: TmdbService,
          useValue: {
            getNetwork,
            getNetworkTv,
            imageUrl: (path: string | null) =>
              path ? `https://image.tmdb.org/t/p/w342${path}` : null,
          },
        },
        {
          provide: TranslateService,
          useValue: { get: (key: string) => key, lang: () => 'en' },
        },
        { provide: IgdbService, useValue: {} },
        { provide: AniListService, useValue: {} },
        {
          provide: CollectionService,
          useValue: { lookupBatch: vi.fn().mockReturnValue(of({})), changes: NEVER },
        },
      ],
    });
  });

  it('loads network details and its TV shows on init', () => {
    const fixture = TestBed.createComponent(EntityPageComponent);
    fixture.detectChanges();

    expect(getNetwork).toHaveBeenCalledWith(213);
    expect(getNetworkTv).toHaveBeenCalledWith(213, 1);

    const component = fixture.componentInstance;
    expect(component.header()).toEqual({
      name: 'Netflix',
      description: 'Streaming service',
      subtitle: 'Los Gatos, California',
      icon: 'tv',
    });
    expect(component.items().length).toBe(1);
    expect(component.items()[0].media.title).toBe('Stranger Things');
    expect(component.hasMore()).toBe(true);
    expect(component.sorts()).toEqual([]);
    expect(component.leadShape()).toBe('logo');
    expect(component.facts()).toEqual([
      { label: 'Los Gatos, California' },
      { value: '1+', label: 'entity.title_one' },
    ]);
  });

  it('renders the shared entity shelf with the network name as page title', () => {
    const fixture = TestBed.createComponent(EntityPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('shelfy-page-hero h1')?.textContent).toContain('Netflix');
    expect(el.querySelector('shelfy-entity-media-grid')).not.toBeNull();
    expect(el.textContent).toContain('Streaming service');
  });

  it('does not ask for the same next page twice while it is loading', () => {
    const fixture = TestBed.createComponent(EntityPageComponent);
    fixture.detectChanges();
    const pending = new Subject<unknown>();
    getNetworkTv.mockReturnValue(pending);

    fixture.componentInstance.loadMore();
    fixture.componentInstance.loadMore();

    expect(getNetworkTv).toHaveBeenCalledTimes(2);
  });

  it('loads next page of TV shows when loadMore is called', () => {
    const fixture = TestBed.createComponent(EntityPageComponent);
    fixture.detectChanges();

    getNetworkTv.mockReturnValue(
      of({
        page: 2,
        totalPages: 2,
        totalResults: 40,
        results: [
          {
            id: 93405,
            name: 'Squid Game',
            posterPath: '/squid.jpg',
            voteAverage: 7.8,
          },
        ],
      }),
    );

    const component = fixture.componentInstance;
    component.loadMore();

    expect(getNetworkTv).toHaveBeenCalledWith(213, 2);
    expect(component.items().length).toBe(2);
    expect(component.items()[1].media.title).toBe('Squid Game');
    expect(component.hasMore()).toBe(false);
  });

  it('navigates to the media detail page when a media item is selected', () => {
    const fixture = TestBed.createComponent(EntityPageComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.componentInstance.openMedia({
      media: { mediaType: 'tv_show', externalId: '66732' },
    } as never);

    expect(navigateSpy).toHaveBeenCalledWith(['/media', 'tv_show', '66732']);
  });

  it('sets header to null and stops loading on error', () => {
    getNetwork.mockReturnValue(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(EntityPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.header()).toBeNull();
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('ignores a slow response for the network the user already left', () => {
    const slowNetwork = new Subject<unknown>();
    getNetwork.mockImplementation((id: number) =>
      id === 213 ? slowNetwork : of({ id, name: 'HBO', headquarters: null }),
    );
    const fixture = TestBed.createComponent(EntityPageComponent);
    fixture.detectChanges();

    paramMap.next(convertToParamMap({ id: '49' }));
    fixture.detectChanges();
    slowNetwork.next({ id: 213, name: 'Netflix', headquarters: null });
    fixture.detectChanges();

    expect(fixture.componentInstance.header()?.name).toBe('HBO');
  });
});

describe('EntityPageComponent - people', () => {
  let paramMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let data: BehaviorSubject<Record<string, unknown>>;
  let getPerson: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    paramMap = new BehaviorSubject(convertToParamMap({ id: '1' }));
    data = new BehaviorSubject<Record<string, unknown>>({ entityKind: 'people' });
    getPerson = vi.fn().mockReturnValue(
      of({
        id: 1,
        name: 'Keanu Reeves',
        biography: 'Actor',
        profilePath: '/keanu.jpg',
        birthday: '1964-09-02',
        credits: [
          {
            mediaType: 'movie',
            mediaId: 100,
            title: 'The Matrix',
            posterPath: '/matrix.jpg',
            voteAverage: 8.7,
            popularity: 90,
            releaseDate: '1999-03-31',
            character: 'Neo',
            job: null,
          },
          {
            mediaType: 'tv',
            mediaId: 200,
            title: 'Some Show',
            posterPath: null,
            voteAverage: 6.5,
            popularity: 40,
            releaseDate: '2010-01-01',
            character: null,
            job: 'Director',
          },
        ],
      }),
    );

    TestBed.configureTestingModule({
      imports: [EntityPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap, data, snapshot: { paramMap: paramMap.value, data: data.value } },
        },
        {
          provide: TmdbService,
          useValue: {
            getPerson,
            imageUrl: (path: string | null) =>
              path ? `https://image.tmdb.org/t/p/w342${path}` : null,
          },
        },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
        { provide: IgdbService, useValue: {} },
        { provide: AniListService, useValue: {} },
        {
          provide: CollectionService,
          useValue: { lookupBatch: vi.fn().mockReturnValue(of({})), changes: NEVER },
        },
      ],
    });
  });

  it('loads a person and their filmography', () => {
    const fixture = TestBed.createComponent(EntityPageComponent);
    fixture.detectChanges();

    expect(getPerson).toHaveBeenCalledWith(1);
    const component = fixture.componentInstance;
    expect(component.isPerson()).toBe(true);
    expect(component.header()?.name).toBe('Keanu Reeves');
    expect(component.displayedItems().length).toBe(2);
  });

  it('maps movie and tv credits to cards the shelf can filter by media type', () => {
    const fixture = TestBed.createComponent(EntityPageComponent);
    fixture.detectChanges();
    const items = fixture.componentInstance.displayedItems();

    expect(items.map((item) => item.media.mediaType)).toEqual(['movie', 'tv_show']);
    expect(items[0].media.metadata?.['role']).toBe('Neo');
    expect(items[1].media.metadata?.['role']).toBe('Director');
  });

  it('sorts displayed items by release date and follows the chosen direction', () => {
    const fixture = TestBed.createComponent(EntityPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.selectPersonCreditSort('releaseDate');
    expect(component.personCreditSort()).toBe('releaseDate');
    expect(component.displayedItems()[0].media.title).toBe('Some Show');

    component.personCreditSortDirection.set('asc');
    expect(component.displayedItems()[0].media.title).toBe('The Matrix');
  });

  it('ignores an invalid sort value', () => {
    const fixture = TestBed.createComponent(EntityPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.selectPersonCreditSort('bogus');

    expect(component.personCreditSort()).toBe('popularity');
  });

  it('offers the popularity and release date sorts, both newest or most popular first', () => {
    const fixture = TestBed.createComponent(EntityPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.sorts()).toEqual([
      { id: 'popularity', label: 'entity.filmography_sort.popularity', natural: 'desc' },
      { id: 'releaseDate', label: 'entity.filmography_sort.releaseDate', natural: 'desc' },
    ]);
  });

  it('shows the birth date and the title count in the hero, with the portrait as lead', () => {
    const fixture = TestBed.createComponent(EntityPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.leadShape()).toBe('portrait');
    expect(component.facts()).toEqual([
      { label: 'entity.born' },
      { value: '2', label: 'entity.title_many' },
    ]);
    const lead = (fixture.nativeElement as HTMLElement).querySelector(
      'img[heroLead]',
    ) as HTMLImageElement;
    expect(lead.getAttribute('src')).toBe('https://image.tmdb.org/t/p/w342/keanu.jpg');
  });

  it('resets the sort and re-fetches credits when the id changes', () => {
    const fixture = TestBed.createComponent(EntityPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.selectPersonCreditSort('releaseDate');

    getPerson.mockReturnValue(
      of({
        id: 2,
        name: 'Carrie-Anne Moss',
        biography: '',
        profilePath: null,
        birthday: null,
        credits: [],
      }),
    );
    paramMap.next(convertToParamMap({ id: '2' }));
    fixture.detectChanges();

    expect(getPerson).toHaveBeenCalledWith(2);
    expect(fixture.componentInstance.personCreditSort()).toBe('popularity');
    expect(fixture.componentInstance.header()?.name).toBe('Carrie-Anne Moss');
  });
});

describe('EntityPageComponent - other kinds', () => {
  function buildRoute(id: string, kind: string) {
    return {
      paramMap: new BehaviorSubject(convertToParamMap({ id })),
      data: new BehaviorSubject<Record<string, unknown>>({ entityKind: kind }),
    };
  }

  function providers(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    route: { paramMap: BehaviorSubject<any>; data: BehaviorSubject<any> },
    overrides: {
      igdb?: Record<string, unknown>;
      anilist?: Record<string, unknown>;
      tmdb?: Record<string, unknown>;
    },
  ) {
    return [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: route.paramMap,
          data: route.data,
          snapshot: { paramMap: route.paramMap.value, data: route.data.value },
        },
      },
      { provide: TmdbService, useValue: overrides.tmdb ?? {} },
      { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      { provide: IgdbService, useValue: overrides.igdb ?? {} },
      { provide: AniListService, useValue: overrides.anilist ?? {} },
      {
        provide: CollectionService,
        useValue: { lookupBatch: vi.fn().mockReturnValue(of({})), changes: NEVER },
      },
    ];
  }

  it('loads staff details from anilist', () => {
    const route = buildRoute('1', 'staff');
    const getStaff = vi.fn().mockReturnValue(
      of({
        name: 'Staff Person',
        description: 'desc',
        imageUrl: null,
        media: [{ mediaType: 'anime', id: 1, title: 'Show', coverImageUrl: null, rating: 7 }],
      }),
    );
    TestBed.configureTestingModule({
      imports: [EntityPageComponent],
      providers: providers(route, { anilist: { getStaff } }),
    });

    const fixture = TestBed.createComponent(EntityPageComponent);
    fixture.detectChanges();

    expect(getStaff).toHaveBeenCalledWith(1);
    expect(fixture.componentInstance.header()?.name).toBe('Staff Person');
    expect(fixture.componentInstance.items().length).toBe(1);
  });

  it('loads character details from anilist', () => {
    const route = buildRoute('1', 'characters');
    const getCharacter = vi
      .fn()
      .mockReturnValue(of({ name: 'A Character', description: '', imageUrl: null, media: [] }));
    TestBed.configureTestingModule({
      imports: [EntityPageComponent],
      providers: providers(route, { anilist: { getCharacter } }),
    });

    const fixture = TestBed.createComponent(EntityPageComponent);
    fixture.detectChanges();

    expect(getCharacter).toHaveBeenCalledWith(1);
    expect(fixture.componentInstance.header()?.name).toBe('A Character');
  });

  it('loads studio details and its media', () => {
    const route = buildRoute('1', 'studios');
    const getStudio = vi.fn().mockReturnValue(
      of({
        name: 'A Studio',
        media: [{ mediaType: 'anime', id: 1, title: 'Show', coverImageUrl: null, rating: 7 }],
      }),
    );
    TestBed.configureTestingModule({
      imports: [EntityPageComponent],
      providers: providers(route, { anilist: { getStudio } }),
    });

    const fixture = TestBed.createComponent(EntityPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.header()?.icon).toBe('grid');
    expect(fixture.componentInstance.items().length).toBe(1);
  });

  it('loads game-company details, games and supports loadMore', () => {
    const route = buildRoute('1', 'game-companies');
    const getCompany = vi
      .fn()
      .mockReturnValue(of({ name: 'A Game Co', description: 'desc', logoImageId: null }));
    const getCompanyGames = vi
      .fn()
      .mockReturnValueOnce(
        of({ content: [{ id: 1, name: 'Game A', coverImageId: null, rating: 80 }], hasMore: true }),
      )
      .mockReturnValueOnce(
        of({
          content: [{ id: 2, name: 'Game B', coverImageId: null, rating: 70 }],
          hasMore: false,
        }),
      );
    const igdb = {
      getCompany,
      getCompanyGames,
      imageUrl: (id: string | null) => (id ? `https://img/${id}` : null),
    };
    TestBed.configureTestingModule({
      imports: [EntityPageComponent],
      providers: providers(route, { igdb }),
    });

    const fixture = TestBed.createComponent(EntityPageComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.items().length).toBe(1);
    expect(fixture.componentInstance.hasMore()).toBe(true);

    fixture.componentInstance.loadMore();
    expect(getCompanyGames).toHaveBeenCalledWith(1, 1);
    expect(fixture.componentInstance.items().length).toBe(2);
    expect(fixture.componentInstance.hasMore()).toBe(false);
  });

  it('loads franchise details, games and supports loadMore', () => {
    const route = buildRoute('1', 'franchises');
    const getFranchise = vi.fn().mockReturnValue(of({ name: 'A Franchise' }));
    const getFranchiseGames = vi
      .fn()
      .mockReturnValueOnce(
        of({ content: [{ id: 1, name: 'Game A', coverImageId: null, rating: 80 }], hasMore: true }),
      )
      .mockReturnValueOnce(
        of({
          content: [{ id: 2, name: 'Game B', coverImageId: null, rating: 70 }],
          hasMore: false,
        }),
      );
    const igdb = {
      getFranchise,
      getFranchiseGames,
      imageUrl: () => null,
    };
    TestBed.configureTestingModule({
      imports: [EntityPageComponent],
      providers: providers(route, { igdb }),
    });

    const fixture = TestBed.createComponent(EntityPageComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.header()?.icon).toBe('game');

    fixture.componentInstance.loadMore();
    expect(getFranchiseGames).toHaveBeenCalledWith(1, 1);
    expect(fixture.componentInstance.items().length).toBe(2);
  });

  it('loads company details, movies/tv and supports loadMore', () => {
    const route = buildRoute('1', 'companies');
    const getCompany = vi
      .fn()
      .mockReturnValue(of({ name: 'A Company', description: null, headquarters: 'Paris' }));
    const getCompanyMovies = vi
      .fn()
      .mockReturnValueOnce(
        of({
          page: 1,
          totalPages: 2,
          totalResults: 2,
          results: [{ id: 1, title: 'Movie', posterPath: null, voteAverage: 7 }],
        }),
      )
      .mockReturnValueOnce(
        of({
          page: 2,
          totalPages: 2,
          totalResults: 2,
          results: [{ id: 2, title: 'Movie 2', posterPath: null, voteAverage: 6 }],
        }),
      );
    const getCompanyTv = vi
      .fn()
      .mockReturnValue(of({ page: 1, totalPages: 1, totalResults: 0, results: [] }));
    const tmdb = {
      getCompany,
      getCompanyMovies,
      getCompanyTv,
      imageUrl: () => null,
    };
    TestBed.configureTestingModule({
      imports: [EntityPageComponent],
      providers: providers(route, { tmdb }),
    });

    const fixture = TestBed.createComponent(EntityPageComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.header()?.subtitle).toBe('Paris');
    expect(fixture.componentInstance.hasMore()).toBe(true);

    fixture.componentInstance.loadMore();
    expect(getCompanyMovies).toHaveBeenCalledWith(1, 2);
    expect(fixture.componentInstance.items().length).toBe(2);
  });

  it('loadMore does nothing when id is missing', () => {
    const route = {
      paramMap: new BehaviorSubject(convertToParamMap({})),
      data: new BehaviorSubject<Record<string, unknown>>({ entityKind: 'studios' }),
    };
    TestBed.configureTestingModule({
      imports: [EntityPageComponent],
      providers: providers(route, {
        anilist: { getStudio: vi.fn().mockReturnValue(of({ name: '', media: [] })) },
      }),
    });

    const fixture = TestBed.createComponent(EntityPageComponent);
    expect(() => {
      fixture.detectChanges();
      fixture.componentInstance.loadMore();
    }).not.toThrow();
  });
});
