import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { EMPTY_EXPLORE_QUERY } from './explore-query';
import { ExploreHistoryService, parseStoredQuery } from './explore-history';

describe('ExploreHistoryService', () => {
  beforeEach(() => localStorage.clear());

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const service = TestBed.inject(ExploreHistoryService);
    TestBed.tick();
    return service;
  }

  it('keeps recent searches unique, newest first, and ignores blank ones', () => {
    const service = setup();
    const horror = { ...EMPTY_EXPLORE_QUERY, with: [{ token: 'horror', label: null }] };

    service.remember(EMPTY_EXPLORE_QUERY);
    service.remember(horror);
    service.remember({ ...EMPTY_EXPLORE_QUERY, text: 'dune' });
    service.remember(horror);

    expect(service.recent().map((query) => query.text || query.with[0].token)).toEqual([
      'horror',
      'dune',
    ]);
  });

  it('drops malformed stored entries', () => {
    expect(parseStoredQuery({ with: [{ token: 1 }], text: 3 })).toBeNull();
    expect(parseStoredQuery('nope')).toBeNull();
    expect(parseStoredQuery({ text: 'dune', sort: 'weird' })).toMatchObject({
      text: 'dune',
      sort: 'popular',
    });
  });
});
