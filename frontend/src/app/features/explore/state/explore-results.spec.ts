import { of, Subject } from 'rxjs';
import { vi } from 'vitest';

import type { SearchService } from '@app/core/services/search/search';
import { EMPTY_EXPLORE_QUERY } from '@app/core/services/search/explore-query';
import type { ExploreResponse, SearchResult } from '@app/core/services/search/search.model';

import { createExploreResults } from './explore-results';

function result(externalId: string): SearchResult {
  return {
    provider: 'tmdb',
    mediaType: 'movie',
    externalId,
    title: externalId,
    posterPath: null,
    overview: '',
    releaseYear: null,
    genres: [],
    voteAverage: null,
    voteCount: null,
    status: null,
    isInCollection: false,
  };
}

function response(page: number, ids: string[], hasMore = true): ExploreResponse {
  return { results: ids.map(result), page, hasMore, unavailableProviders: [], skippedTypes: [] };
}

describe('createExploreResults', () => {
  it('appends the next page without duplicating titles', () => {
    const explore = vi
      .fn()
      .mockReturnValueOnce(of(response(1, ['1', '2'])))
      .mockReturnValueOnce(of(response(2, ['2', '3'], false)));
    const state = createExploreResults({
      searchService: { explore } as unknown as SearchService,
      region: () => 'FR',
    });

    state.load(EMPTY_EXPLORE_QUERY);
    state.loadMore();

    expect(state.results().map((r) => r.externalId)).toEqual(['1', '2', '3']);
    expect(state.hasMore()).toBe(false);
    expect(explore).toHaveBeenLastCalledWith(EMPTY_EXPLORE_QUERY, 2, 'FR');
  });

  it('ignores a response that arrives after the query changed', () => {
    const stale = new Subject<ExploreResponse>();
    const explore = vi
      .fn()
      .mockReturnValueOnce(stale)
      .mockReturnValueOnce(of(response(1, ['fresh'])));
    const state = createExploreResults({
      searchService: { explore } as unknown as SearchService,
      region: () => 'FR',
    });

    state.load(EMPTY_EXPLORE_QUERY);
    state.load({ ...EMPTY_EXPLORE_QUERY, text: 'dune' });
    stale.next(response(1, ['stale']));

    expect(state.results().map((r) => r.externalId)).toEqual(['fresh']);
  });

  it('keeps the loaded page and offers a retry when the next one fails', () => {
    const failure = new Subject<ExploreResponse>();
    const explore = vi
      .fn()
      .mockReturnValueOnce(of(response(1, ['1'])))
      .mockReturnValueOnce(failure)
      .mockReturnValueOnce(of(response(2, ['2'], false)));
    const state = createExploreResults({
      searchService: { explore } as unknown as SearchService,
      region: () => 'FR',
    });

    state.load(EMPTY_EXPLORE_QUERY);
    state.loadMore();
    failure.error(new Error('down'));
    expect(state.failed()).toBe(true);
    state.retry();

    expect(state.results().map((r) => r.externalId)).toEqual(['1', '2']);
    expect(explore).toHaveBeenLastCalledWith(EMPTY_EXPLORE_QUERY, 2, 'FR');
  });

  it('keeps the previous results on screen while the next query loads', () => {
    const next = new Subject<ExploreResponse>();
    const explore = vi
      .fn()
      .mockReturnValueOnce(of(response(1, ['old'])))
      .mockReturnValueOnce(next);
    const state = createExploreResults({
      searchService: { explore } as unknown as SearchService,
      region: () => 'FR',
    });

    state.load(EMPTY_EXPLORE_QUERY);
    state.load({ ...EMPTY_EXPLORE_QUERY, text: 'dune' });

    expect(state.results().map((r) => r.externalId)).toEqual(['old']);
    expect(state.refreshing()).toBe(true);
    expect(state.loaded()).toBe(false);

    next.next(response(1, ['new']));
    expect(state.results().map((r) => r.externalId)).toEqual(['new']);
    expect(state.refreshing()).toBe(false);
  });

  it('drops the previous results when the next query fails', () => {
    const next = new Subject<ExploreResponse>();
    const explore = vi
      .fn()
      .mockReturnValueOnce(of(response(1, ['old'])))
      .mockReturnValueOnce(next);
    const state = createExploreResults({
      searchService: { explore } as unknown as SearchService,
      region: () => 'FR',
    });

    state.load(EMPTY_EXPLORE_QUERY);
    state.load({ ...EMPTY_EXPLORE_QUERY, text: 'dune' });
    next.error(new Error('down'));

    expect(state.results()).toEqual([]);
    expect(state.failed()).toBe(true);
    expect(state.refreshing()).toBe(false);
  });
});
