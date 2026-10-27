import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router, type Params } from '@angular/router';
import { BehaviorSubject, NEVER, of } from 'rxjs';
import { vi } from 'vitest';
import { AddSheetService } from '@app/core/services/add-sheet/add-sheet';
import { AuthService } from '@app/core/services/auth/auth';
import { CollectionService } from '@app/core/services/collection/collection';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ItemSheetService } from '@app/core/services/item-sheet/item-sheet';
import { ExploreCatalogService } from '@app/core/services/search/explore-catalog';
import { ExploreHistoryService } from '@app/core/services/search/explore-history';
import { SearchService } from '@app/core/services/search/search';
import type { ExploreResponse, SearchResult } from '@app/core/services/search/search.model';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { ExplorePageComponent } from './explore';

function result(externalId: string, overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    provider: 'tmdb',
    mediaType: 'movie',
    externalId,
    title: `Title ${externalId}`,
    posterPath: null,
    overview: '',
    releaseYear: 2020,
    genres: [],
    voteAverage: null,
    voteCount: null,
    status: null,
    isInCollection: false,
    ...overrides,
  };
}

function response(results: SearchResult[]): ExploreResponse {
  return { results, page: 0, hasMore: false, unavailableProviders: [], skippedTypes: [] };
}

describe('ExplorePageComponent', () => {
  let navigate: ReturnType<typeof vi.fn>;
  let explore: ReturnType<typeof vi.fn>;
  let history: Record<'remember', ReturnType<typeof vi.fn>> & {
    hideOwned: WritableSignal<boolean>;
  };
  let collection: Record<'lookupBatch' | 'remove', ReturnType<typeof vi.fn>>;
  let toast: Record<'success' | 'warning' | 'error', ReturnType<typeof vi.fn>>;
  let itemSheet: { open: ReturnType<typeof vi.fn> };
  let addSheet: { open: ReturnType<typeof vi.fn> };
  let confirm: { ask: ReturnType<typeof vi.fn> };

  async function setup(query: Params = { type: 'movie' }, results = [result('1'), result('2')]) {
    navigate = vi.fn().mockResolvedValue(true);
    explore = vi.fn().mockReturnValue(of(response(results)));
    history = {
      hideOwned: signal(false),
      remember: vi.fn(),
    };
    collection = {
      lookupBatch: vi.fn().mockReturnValue(of({})),
      remove: vi.fn(),
    };
    toast = { success: vi.fn(), warning: vi.fn(), error: vi.fn() };
    itemSheet = { open: vi.fn() };
    addSheet = { open: vi.fn() };
    confirm = { ask: vi.fn() };
    TestBed.overrideComponent(ExplorePageComponent, { set: { template: '', imports: [] } });
    TestBed.configureTestingModule({
      imports: [ExplorePageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: new BehaviorSubject(convertToParamMap(query)),
            snapshot: { queryParamMap: convertToParamMap(query) },
          },
        },
        { provide: Router, useValue: { navigate } },
        { provide: SearchService, useValue: { explore } },
        { provide: CollectionService, useValue: { ...collection, changes: NEVER } },
        { provide: ItemSheetService, useValue: itemSheet },
        { provide: AddSheetService, useValue: addSheet },
        { provide: AuthService, useValue: { currentUser: signal(null) } },
        {
          provide: ExploreCatalogService,
          useValue: {
            load: vi.fn(),
            region: () => 'FR',
            typeLabel: (type: string) => type,
            label: (criterion: { token: string }) => criterion.token,
          },
        },
        { provide: ExploreHistoryService, useValue: history },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmService, useValue: confirm },
        { provide: ErrorMessageService, useValue: { fromApiError: () => 'failed' } },
        {
          provide: TranslateService,
          useValue: { get: (key: string) => key, lang: () => 'en' },
        },
      ],
    });
    const fixture = TestBed.createComponent(ExplorePageComponent);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  const lastRoute = () => navigate.mock.lastCall?.[1]?.queryParams;

  it('searches for the query in the URL and remembers it', async () => {
    const page = await setup({ type: 'movie', sort: 'rating' });

    expect(explore).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'movie', sort: 'rating' }),
      1,
      'FR',
    );
    expect(history.remember).toHaveBeenCalled();
    expect(page.visibleResults().map((r) => r.externalId)).toEqual(['1', '2']);
  });

  it('opens on a blank search instead of the last one', async () => {
    await setup({}, []);

    expect(navigate).not.toHaveBeenCalled();
  });

  it('hides titles already on the shelf when asked to', async () => {
    const page = await setup({}, [result('1', { isInCollection: true }), result('2'), result('3')]);
    collection.lookupBatch.mockReturnValue(of({}));
    history.hideOwned.set(true);

    expect(page.visibleResults().map((r) => r.externalId)).toEqual(['2', '3']);
  });

  it('merges a change into the query and drops the default sort from the URL', async () => {
    const page = await setup({ type: 'movie', sort: 'rating' });

    page.update({ sort: 'popular', from: 1990 });

    expect(lastRoute()).toMatchObject({ type: 'movie', sort: null, from: 1990 });
  });

  it('removes an excluded criterion before an included one', async () => {
    const page = await setup({ q: 'dune', with: 'scifi', without: 'horror', from: '1980' });

    page.removeLastCriterion();
    expect(lastRoute()).toMatchObject({ without: null, with: ['scifi'] });
  });

  it('removes the years before the text once no criterion is left', async () => {
    const page = await setup({ q: 'dune', from: '1980', to: '1990' });

    page.removeLastCriterion();
    expect(lastRoute()).toMatchObject({ from: null, to: null, q: 'dune' });
  });

  it('searches with a blank query so the grid shows popular titles', async () => {
    const page = await setup({});

    expect(explore).toHaveBeenCalledWith(
      expect.objectContaining({ text: '', type: null, sort: 'popular' }),
      1,
      'FR',
    );
    expect(page.visibleResults()).toHaveLength(2);
  });

  it('labels each card with its type and year', async () => {
    const page = await setup();

    expect(page.cardMeta(result('1'))).toMatch(/^collection\.media_type_one\.movie( · \d{4})?$/);
  });
});
