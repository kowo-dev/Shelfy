import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';

import { AddSheetService } from '@app/core/services/add-sheet/add-sheet';
import { AmbientService } from '@app/core/services/ambient/ambient';
import { AuthService } from '@app/core/services/auth/auth';
import { CollectionService } from '@app/core/services/collection/collection';
import type {
  CollectionItemResponse,
  CollectionListParams,
  NextEpisodeResponse,
} from '@app/core/services/collection/collection.model';
import { DiscoverService } from '@app/core/services/discover/discover';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { ItemSheetService } from '@app/core/services/item-sheet/item-sheet';
import { ListsService } from '@app/core/services/lists/lists';
import { ExploreCatalogService } from '@app/core/services/search/explore-catalog';
import { SearchService } from '@app/core/services/search/search';
import { ShelfLookupService } from '@app/core/services/shelf-lookup/shelf-lookup';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { TranslateService } from '@app/core/services/translate/translate';
import { UserProfileService } from '@app/core/services/users/user-profile';
import { VersusService } from '@app/core/services/versus/versus';

import { DiscoverPageComponent } from './discover';

const movie = (id: number) => ({
  id,
  title: `Movie ${id}`,
  overview: '',
  posterPath: `/p${id}`,
  backdropPath: `/b${id}`,
  releaseDate: '2026-01-01',
  genreIds: [],
  voteAverage: 7,
});

const page = (content: unknown[]) => of({ content, page: 0, size: 20, totalElements: 0 });

const mine = (id: string, title: string, mediaType: string): CollectionItemResponse =>
  ({
    id,
    status: 'ongoing',
    rating: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    media: {
      id: 'm' + id,
      provider: 'igdb',
      mediaType,
      externalId: id,
      title,
      coverUrl: null,
      metadata: null,
    },
  }) as unknown as CollectionItemResponse;

const episode = (item: CollectionItemResponse): NextEpisodeResponse => ({
  item,
  season: 1,
  episode: 3,
  title: 'Pilot',
  airDate: '2026-10-27',
  airingAt: null,
  stillPath: null,
});

describe('DiscoverPageComponent', () => {
  let discover: Record<string, ReturnType<typeof vi.fn>>;
  let collection: Record<string, unknown>;
  let addSheet: { open: ReturnType<typeof vi.fn> };
  let itemSheet: { open: ReturnType<typeof vi.fn> };
  let ongoing: CollectionItemResponse[];
  let total: number;

  beforeEach(async () => {
    localStorage.clear();
    ongoing = [];
    total = 3;
    discover = {
      getMovies: vi.fn((feed: string) =>
        feed === 'trending' ? page([1, 2, 3].map(movie)) : page([]),
      ),
      getSeries: vi.fn(() => page([])),
      getGames: vi.fn(() => page([])),
      getAnime: vi.fn(() => page([])),
      getManga: vi.fn(() => page([])),
      getWebtoons: vi.fn(() => page([])),
    };
    collection = {
      list: vi.fn((params: CollectionListParams) =>
        page(params.status?.includes('ongoing') ? ongoing : []),
      ),
      stats: vi.fn(() => of({ total, countsByMediaType: {} })),
      nextEpisodes: vi.fn(() =>
        of(ongoing.filter((item) => item.media.mediaType === 'tv_show').map(episode)),
      ),
      update: vi.fn(() => of({})),
      changes: new Subject(),
    };
    addSheet = { open: vi.fn() };
    itemSheet = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [DiscoverPageComponent],
      providers: [
        provideRouter([]),
        { provide: DiscoverService, useValue: discover },
        {
          provide: TmdbService,
          useValue: {
            imageUrl: (path: string | null, size = '') => (path ? `${size}${path}` : null),
            getMovie: (id: number) => of({ backdropImagePaths: [`/clean${id}`] }),
            getTvShow: () => of({ backdropImagePaths: [] }),
          },
        },
        { provide: IgdbService, useValue: { imageUrl: () => null, getGame: () => of({}) } },
        { provide: CollectionService, useValue: collection },
        { provide: AuthService, useValue: { isAuthenticated: () => true } },
        { provide: ShelfLookupService, useValue: { find: () => null, request: vi.fn() } },
        { provide: AddSheetService, useValue: addSheet },
        { provide: ItemSheetService, useValue: itemSheet },
        { provide: SearchService, useValue: { explore: () => of({ results: [] }) } },
        { provide: ExploreCatalogService, useValue: { region: () => 'FR' } },
        { provide: UserProfileService, useValue: { browseReviews: () => page([]) } },
        { provide: ListsService, useValue: { browse: () => page([]) } },
        { provide: VersusService, useValue: { browsePools: () => page([]) } },
        {
          provide: AmbientService,
          useValue: {
            follow: vi.fn(() => Promise.resolve()),
            colorOf: () => Promise.resolve(null),
            brightnessOf: () => Promise.resolve(0.2),
          },
        },
        {
          provide: TranslateService,
          useValue: { get: (key: string) => key, lang: () => 'en' },
        },
      ],
    }).compileComponents();
  });

  async function createComponent() {
    const fixture = TestBed.createComponent(DiscoverPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const stageTitle = (fixture: Awaited<ReturnType<typeof createComponent>>) =>
    (fixture.nativeElement as HTMLElement).querySelector('#home-stage-title')?.textContent?.trim();

  it('offers every medium after "All"', async () => {
    const fixture = await createComponent();

    expect(fixture.componentInstance.tabs().map((tab) => tab.id)).toEqual([
      'all',
      'movie',
      'tv_show',
      'game',
      'anime',
      'manga',
      'webtoon',
    ]);
  });

  it('features one trending title that has clean artwork', async () => {
    const fixture = await createComponent();

    const featured = fixture.componentInstance.featured()!;

    expect(featured.art?.full).toBe(`original/clean${featured.item.media.externalId}`);
    expect(stageTitle(fixture)).toBe(featured.item.media.title);
  });

  it('filters the whole page by medium and restores the choice later', async () => {
    const fixture = await createComponent();
    fixture.componentInstance.selectFilter('tv_show');

    expect(fixture.componentInstance.filter()).toBe('tv_show');
    expect(discover['getSeries']).toHaveBeenCalledWith('trending', 0, expect.any(Number));
    await vi.waitFor(() => expect(fixture.componentInstance.shown()).toBe('tv_show'));
    expect((await createComponent()).componentInstance.filter()).toBe('tv_show');
  });

  it('ignores an unknown filter', async () => {
    const fixture = await createComponent();
    fixture.componentInstance.selectFilter('bogus');

    expect(fixture.componentInstance.filter()).toBe('all');
  });

  it('keeps Continue and next episodes to the chosen medium', async () => {
    ongoing = [mine('1', 'Silksong', 'game'), mine('2', 'Severance', 'tv_show')];
    const fixture = await createComponent();
    const page = fixture.componentInstance;

    expect(page.ongoing().map((item) => item.media.title)).toEqual(['Silksong', 'Severance']);
    expect(page.episodes()).toHaveLength(1);

    page.selectFilter('game');
    await vi.waitFor(() => expect(page.shown()).toBe('game'));
    expect(page.ongoing().map((item) => item.media.title)).toEqual(['Silksong']);
    expect(page.episodes()).toEqual([]);
  });

  it('opens the add sheet for a staged title', async () => {
    const fixture = await createComponent();
    const staged = fixture.componentInstance.featured()!.item;

    fixture.componentInstance.shelve(staged);

    expect(addSheet.open).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: staged.media.externalId, mediaType: 'movie' }),
    );
  });

  it('marks an in-progress title done and opens its edit sheet', async () => {
    const severance = mine('2', 'Severance', 'tv_show');
    const done = { ...severance, status: 'done' };
    ongoing = [severance];
    (collection['update'] as ReturnType<typeof vi.fn>).mockReturnValue(of(done));
    const fixture = await createComponent();

    fixture.componentInstance.finish(severance);

    expect(collection['update']).toHaveBeenCalledWith('2', { status: 'done' });
    expect(itemSheet.open).toHaveBeenCalledWith(done);
    expect(fixture.componentInstance.finishing()).toBeNull();
  });

  it('invites an empty shelf to start', async () => {
    total = 0;
    const fixture = await createComponent();

    expect(fixture.componentInstance.showStart()).toBe(true);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('shelfy-start-shelf'),
    ).not.toBeNull();
  });
});
