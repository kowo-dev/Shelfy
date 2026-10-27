import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '@env';
import type { PagedResponse } from '@app/core/services/collection/collection.model';
import { PeopleService } from './people';

const BASE_URL = `${environment.baseUrl}/people`;

describe('PeopleService', () => {
  let service: PeopleService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PeopleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('search() sends the query, page and size as params', () => {
    let result: PagedResponse<unknown> | undefined;
    service.search('kowo', 1, 5).subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url === `${BASE_URL}/search`);
    expect(req.request.params.get('query')).toBe('kowo');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('size')).toBe('5');

    const response: PagedResponse<unknown> = { content: [], page: 0, size: 5, totalElements: 0 };
    req.flush(response);
    expect(result).toEqual(response);
  });

  it('onMedia() asks who among the people I follow has the title', () => {
    service.onMedia('tmdb', 'movie', '42').subscribe();

    const req = httpMock.expectOne((r) => r.url === `${BASE_URL}/media`);
    expect(req.request.params.get('provider')).toBe('tmdb');
    expect(req.request.params.get('mediaType')).toBe('movie');
    expect(req.request.params.get('externalId')).toBe('42');
    req.flush([]);
  });
});
