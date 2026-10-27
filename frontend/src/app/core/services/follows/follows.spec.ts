import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '@env';
import type { PagedResponse } from '@app/core/services/collection/collection.model';
import { FollowsService, type FollowUserResponse } from './follows';

const BASE_URL = `${environment.baseUrl}/follows`;

function user(overrides: Partial<FollowUserResponse> = {}): FollowUserResponse {
  return {
    id: 'u1',
    username: 'kowo',
    displayName: null,
    avatarUrl: null,
    bannerUrl: null,
    titleCount: null,
    coverUrls: [],
    ...overrides,
  };
}

function paged(content: FollowUserResponse[]): PagedResponse<FollowUserResponse> {
  return { content, page: 0, size: 20, totalElements: content.length };
}

describe('FollowsService', () => {
  let service: FollowsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FollowsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('follow() posts to /follows/:userId', () => {
    let done = false;
    service.follow('u1').subscribe(() => (done = true));

    const req = httpMock.expectOne(`${BASE_URL}/u1`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(null);

    expect(done).toBe(true);
  });

  it('unfollow() deletes /follows/:userId', () => {
    let done = false;
    service.unfollow('u1').subscribe(() => (done = true));

    const req = httpMock.expectOne(`${BASE_URL}/u1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(done).toBe(true);
  });

  it('following() requests /follows/following with default paging', () => {
    let result: PagedResponse<FollowUserResponse> | undefined;
    service.following().subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url === `${BASE_URL}/following` && r.method === 'GET');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');

    const response = paged([user()]);
    req.flush(response);

    expect(result).toEqual(response);
  });

  it('followers() requests /follows/followers with the given page and size', () => {
    service.followers(2, 5).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${BASE_URL}/followers`);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('5');
    req.flush(paged([]));
  });

  it('followingOf() requests /follows/:userId/following', () => {
    service.followingOf('u2', 1, 10).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${BASE_URL}/u2/following`);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('size')).toBe('10');
    req.flush(paged([]));
  });

  it('followersOf() requests /follows/:userId/followers', () => {
    service.followersOf('u2').subscribe();

    const req = httpMock.expectOne((r) => r.url === `${BASE_URL}/u2/followers`);
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    req.flush(paged([]));
  });

  it('propagates a 404 when following a non-existent user', () => {
    let error: unknown;
    service.follow('missing').subscribe({ error: (err) => (error = err) });

    httpMock.expectOne(`${BASE_URL}/missing`).flush(null, { status: 404, statusText: 'Not Found' });

    expect((error as { status: number }).status).toBe(404);
  });
});
