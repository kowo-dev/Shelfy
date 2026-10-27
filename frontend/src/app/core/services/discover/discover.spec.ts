import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '@env';
import type { PagedResponse } from '@app/core/services/collection/collection.model';
import { DiscoverService } from './discover';
import type { DiscoverFeed } from './discover.model';

const BASE_URL = `${environment.baseUrl}/discover`;

function paged<T>(content: T[]): PagedResponse<T> {
  return { content, page: 0, size: 20, totalElements: content.length };
}

describe('DiscoverService', () => {
  let service: DiscoverService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DiscoverService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  const cases: [method: keyof DiscoverService, path: string][] = [
    ['getMovies', 'movies'],
    ['getSeries', 'series'],
    ['getGames', 'games'],
    ['getAnime', 'anime'],
    ['getManga', 'manga'],
    ['getWebtoons', 'webtoons'],
  ];

  for (const [method, path] of cases) {
    it(`${method}() requests ${path}/top_rated with page and size params`, () => {
      let result: PagedResponse<unknown> | undefined;
      (
        service[method] as (
          feed: DiscoverFeed,
          page: number,
          size: number,
        ) => import('rxjs').Observable<unknown>
      )('top_rated', 1, 10).subscribe((r) => (result = r as PagedResponse<unknown>));

      const req = httpMock.expectOne(
        (r) => r.url === `${BASE_URL}/${path}/top_rated` && r.method === 'GET',
      );
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('10');

      const response = paged([{ id: '1' }]);
      req.flush(response);

      expect(result).toEqual(response);
    });
  }

  it('propagates a server error to the caller', () => {
    let error: unknown;
    service.getMovies('trending', 0, 20).subscribe({ error: (err) => (error = err) });

    const req = httpMock.expectOne(`${BASE_URL}/movies/trending?page=0&size=20`);
    req.flush(null, { status: 500, statusText: 'Server Error' });

    expect((error as { status: number }).status).toBe(500);
  });
});
