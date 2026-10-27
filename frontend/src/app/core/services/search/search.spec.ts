import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '@env';
import type { SearchResponse } from './search.model';
import { SearchService } from './search';

const BASE_URL = `${environment.baseUrl}/search`;

function searchResponse(overrides: Partial<SearchResponse> = {}): SearchResponse {
  return {
    results: [],
    page: 1,
    hasMore: false,
    unavailableProviders: [],
    ...overrides,
  };
}

describe('SearchService', () => {
  let service: SearchService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SearchService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('search() sends the query and defaults page to 1', () => {
    let result: SearchResponse | undefined;
    service.search('inception').subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url === BASE_URL && r.method === 'GET');
    expect(req.request.params.get('query')).toBe('inception');
    expect(req.request.params.get('page')).toBe('1');

    const response = searchResponse();
    req.flush(response);

    expect(result).toEqual(response);
  });

  it('search() sends a custom page number', () => {
    service.search('inception', 3).subscribe();

    const req = httpMock.expectOne((r) => r.url === BASE_URL);
    expect(req.request.params.get('page')).toBe('3');
    req.flush(searchResponse({ page: 3 }));
  });

  it('propagates an error when the search backend fails', () => {
    let error: unknown;
    service.search('inception').subscribe({ error: (err) => (error = err) });

    httpMock
      .expectOne((r) => r.url === BASE_URL)
      .flush(null, {
        status: 500,
        statusText: 'Server Error',
      });

    expect((error as { status: number }).status).toBe(500);
  });
});
