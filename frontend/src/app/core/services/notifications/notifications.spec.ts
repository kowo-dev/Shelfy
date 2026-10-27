import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '@env';
import type { PagedResponse } from '@app/core/services/collection/collection.model';
import type { NotificationResponse } from './notifications.model';
import { NotificationsService } from './notifications';

const BASE_URL = `${environment.baseUrl}/notifications`;

function notification(overrides: Partial<NotificationResponse> = {}): NotificationResponse {
  return {
    id: 'n1',
    type: 'FRIEND_REQUEST',
    family: 'RELATIONS',
    actor: null,
    actors: [],
    actorCount: 0,
    targetType: null,
    targetId: null,
    payload: {},
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isRead: false,
    isResolved: false,
    ...overrides,
  };
}

describe('NotificationsService', () => {
  let service: NotificationsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NotificationsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list() requests the base URL with page and size params', () => {
    let result: PagedResponse<NotificationResponse> | undefined;
    service.list(1, 5).subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url === BASE_URL && r.method === 'GET');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('size')).toBe('5');

    const response: PagedResponse<NotificationResponse> = {
      content: [notification()],
      page: 1,
      size: 5,
      totalElements: 1,
    };
    req.flush(response);

    expect(result).toEqual(response);
  });

  it('markRead() puts to /notifications/:id/read and bumps the change signal', () => {
    const before = service.changes();
    service.markRead('n1').subscribe();

    const req = httpMock.expectOne(`${BASE_URL}/n1/read`);
    expect(req.request.method).toBe('PUT');
    req.flush(null);

    expect(service.changes()).toBe(before + 1);
  });

  it('markAllRead() puts to /notifications/read-all and bumps the change signal', () => {
    const before = service.changes();
    service.markAllRead().subscribe();

    const req = httpMock.expectOne(`${BASE_URL}/read-all`);
    expect(req.request.method).toBe('PUT');
    req.flush(null);

    expect(service.changes()).toBe(before + 1);
  });

  it('clear() deletes one notification and bumps the change signal', () => {
    const before = service.changes();
    service.clear('n1').subscribe();

    const req = httpMock.expectOne(`${BASE_URL}/n1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(service.changes()).toBe(before + 1);
  });

  it('clearAll() deletes the whole history', () => {
    service.clearAll().subscribe();

    const req = httpMock.expectOne(BASE_URL);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('propagates an error from list() without touching the change signal', () => {
    const before = service.changes();
    let error: unknown;
    service.list().subscribe({ error: (err) => (error = err) });

    httpMock
      .expectOne((r) => r.url === BASE_URL)
      .flush(null, {
        status: 500,
        statusText: 'Server Error',
      });

    expect((error as { status: number }).status).toBe(500);
    expect(service.changes()).toBe(before);
  });

  it('list() passes the family filter when one is chosen', () => {
    service.list(0, 20, 'LIKES').subscribe();

    const req = httpMock.expectOne((r) => r.url === BASE_URL);
    expect(req.request.params.get('family')).toBe('LIKES');
    req.flush({ content: [], page: 0, size: 20, totalElements: 0 });
  });

  it('requests() reads the pinned open requests', () => {
    let result: NotificationResponse[] | undefined;
    service.requests().subscribe((r) => (result = r));

    httpMock.expectOne(`${BASE_URL}/requests`).flush([notification()]);

    expect(result?.length).toBe(1);
  });

  it('updatePreferences() puts only the changed values', () => {
    service.updatePreferences({ families: { LIKES: false } }).subscribe();

    const req = httpMock.expectOne(`${BASE_URL}/preferences`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ families: { LIKES: false } });
    req.flush({ audience: 'EVERYONE', families: [] });
  });

  it('summary() reads the grouped unread counts', () => {
    let result: { total: number; personal: number } | undefined;
    service.summary().subscribe((r) => (result = r));

    httpMock
      .expectOne(`${BASE_URL}/summary`)
      .flush({ total: 4, personal: 1, families: { LIKES: 3 }, all: 9, totals: { LIKES: 9 } });

    expect(result).toEqual({
      total: 4,
      personal: 1,
      families: { LIKES: 3 },
      all: 9,
      totals: { LIKES: 9 },
    });
  });
});
