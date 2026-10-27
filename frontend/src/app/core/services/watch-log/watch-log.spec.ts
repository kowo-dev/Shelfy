import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '@env';
import type { UpsertWatchLogRequest, WatchLogEntry } from './watch-log.model';
import { WatchLogService } from './watch-log';

const BASE_URL = `${environment.baseUrl}/collection/items`;

function entry(overrides: Partial<WatchLogEntry> = {}): WatchLogEntry {
  return {
    id: 'log1',
    occurredAt: '2024-01-01T00:00:00Z',
    isRewatch: false,
    name: null,
    rating: 8,
    review: null,
    containsSpoilers: false,
    source: 'manual',
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function upsertRequest(overrides: Partial<UpsertWatchLogRequest> = {}): UpsertWatchLogRequest {
  return {
    occurredAt: '2024-01-01T00:00:00Z',
    isRewatch: false,
    name: null,
    rating: 8,
    review: null,
    containsSpoilers: false,
    ...overrides,
  };
}

describe('WatchLogService', () => {
  let service: WatchLogService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WatchLogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list() requests /collection/items/:itemId/watch-log', () => {
    let result: WatchLogEntry[] | undefined;
    service.list('item1').subscribe((r) => (result = r));

    const response = [entry()];
    const req = httpMock.expectOne(`${BASE_URL}/item1/watch-log`);
    expect(req.request.method).toBe('GET');
    req.flush(response);

    expect(result).toEqual(response);
  });

  it('create() posts the request body to /collection/items/:itemId/watch-log', () => {
    const request = upsertRequest();
    let result: WatchLogEntry | undefined;
    service.create('item1', request).subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${BASE_URL}/item1/watch-log`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    const response = entry();
    req.flush(response);

    expect(result).toEqual(response);
  });

  it('update() puts the request body to /collection/items/:itemId/watch-log/:logId', () => {
    const request = upsertRequest({ rating: 9 });
    service.update('item1', 'log1', request).subscribe();

    const req = httpMock.expectOne(`${BASE_URL}/item1/watch-log/log1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(request);
    req.flush(entry({ rating: 9 }));
  });

  it('delete() removes /collection/items/:itemId/watch-log/:logId', () => {
    let done = false;
    service.delete('item1', 'log1').subscribe(() => (done = true));

    const req = httpMock.expectOne(`${BASE_URL}/item1/watch-log/log1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(done).toBe(true);
  });

  it('propagates a 404 when the item does not exist', () => {
    let error: unknown;
    service.list('missing').subscribe({ error: (err) => (error = err) });

    httpMock
      .expectOne(`${BASE_URL}/missing/watch-log`)
      .flush(null, { status: 404, statusText: 'Not Found' });

    expect((error as { status: number }).status).toBe(404);
  });
});
