import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiError } from '../errors/api-error';
import { apiErrorInterceptor } from './api-error.interceptor';

const URL = 'https://api.example.com/things';

describe('apiErrorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('passes a successful response through unchanged', () => {
    let result: unknown;
    http.get(URL).subscribe((r) => (result = r));

    httpMock.expectOne(URL).flush({ ok: true });

    expect(result).toEqual({ ok: true });
  });

  it('converts an HttpErrorResponse into an ApiError using the response body detail and code', () => {
    let error: unknown;
    http.get(URL).subscribe({ error: (err) => (error = err) });

    httpMock
      .expectOne(URL)
      .flush(
        { detail: 'Thing not found', code: 'THING_NOT_FOUND' },
        { status: 404, statusText: 'Not Found' },
      );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).detail).toBe('Thing not found');
    expect((error as ApiError).code).toBe('THING_NOT_FOUND');
  });

  it('infers a code from the status when the response body has none', () => {
    let error: unknown;
    http.get(URL).subscribe({ error: (err) => (error = err) });

    httpMock.expectOne(URL).flush(null, { status: 500, statusText: 'Server Error' });

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(500);
    expect((error as ApiError).code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('maps a 401 response to an UNAUTHORIZED ApiError', () => {
    let error: unknown;
    http.get(URL).subscribe({ error: (err) => (error = err) });

    httpMock.expectOne(URL).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect((error as ApiError).code).toBe('UNAUTHORIZED');
  });
});
