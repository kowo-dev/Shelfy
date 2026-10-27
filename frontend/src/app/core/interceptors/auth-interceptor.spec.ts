import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { environment } from '@env';
import type { AuthResponse } from '@app/core/services/auth/auth.model';
import { AuthService } from '@app/core/services/auth/auth';
import { authInterceptor } from './auth-interceptor';

function authServiceMock(token: string | null) {
  return {
    accessToken: signal(token),
    isAuthenticated: signal(token !== null),
    refreshToken: vi.fn(),
    setAccessToken: vi.fn(),
    clearSession: vi.fn(),
    logout: vi.fn(),
  };
}

const ME_URL = `${environment.baseUrl}/users/me`;
const LOGIN_URL = `${environment.baseUrl}/auth/login`;

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: ReturnType<typeof authServiceMock>;

  function setup(token: string | null = 'access-token'): void {
    auth = authServiceMock(token);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('adds credentials and the bearer token to a regular request', () => {
    setup('access-token');
    http.get(ME_URL).subscribe();

    const req = httpMock.expectOne(ME_URL);
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-token');
    req.flush({});
  });

  it('does not add a bearer token when there is none', () => {
    setup(null);
    http.get(ME_URL).subscribe();

    const req = httpMock.expectOne(ME_URL);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('does not add a bearer token on an auth endpoint, even with a token available', () => {
    setup('access-token');
    http.post(LOGIN_URL, {}).subscribe();

    const req = httpMock.expectOne(LOGIN_URL);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('does not overwrite an Authorization header already set on the request', () => {
    setup('access-token');
    http.get(ME_URL, { headers: { Authorization: 'Bearer custom' } }).subscribe();

    const req = httpMock.expectOne(ME_URL);
    expect(req.request.headers.get('Authorization')).toBe('Bearer custom');
    req.flush({});
  });

  it('propagates a 401 from an auth endpoint without attempting a refresh', () => {
    setup('access-token');
    let error: unknown;
    http.post(LOGIN_URL, {}).subscribe({ error: (err) => (error = err) });

    const req = httpMock.expectOne(LOGIN_URL);
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.refreshToken).not.toHaveBeenCalled();
    expect((error as { status: number }).status).toBe(401);
  });

  it('propagates a 401 without attempting a refresh when there was no session to begin with', () => {
    setup(null);
    let error: unknown;
    http.get(ME_URL).subscribe({ error: (err) => (error = err) });

    const req = httpMock.expectOne(ME_URL);
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.refreshToken).not.toHaveBeenCalled();
    expect(auth.logout).not.toHaveBeenCalled();
    expect(auth.clearSession).not.toHaveBeenCalled();
    expect((error as { status: number }).status).toBe(401);
  });

  it('refreshes the token, updates the service, and retries the original request', async () => {
    setup('expired-token');
    auth.refreshToken.mockReturnValue(
      of<AuthResponse>({
        accessToken: 'new-token',
        tokenType: 'Bearer',
        expiresInSeconds: 900,
      }),
    );

    let result: unknown;
    http.get(ME_URL).subscribe((value) => (result = value));

    httpMock.expectOne(ME_URL).flush(null, { status: 401, statusText: 'Unauthorized' });

    await vi.waitFor(() => expect(auth.setAccessToken).toHaveBeenCalledWith('new-token'));

    const retried = await vi.waitFor(() => httpMock.expectOne(ME_URL));
    expect(retried.request.headers.get('Authorization')).toBe('Bearer new-token');
    retried.flush({ ok: true });

    await vi.waitFor(() => expect(result).toEqual({ ok: true }));
  });

  it('deduplicates concurrent 401s into a single refresh call', async () => {
    setup('expired-token');
    auth.refreshToken.mockReturnValue(
      of<AuthResponse>({
        accessToken: 'new-token',
        tokenType: 'Bearer',
        expiresInSeconds: 900,
      }),
    );

    http.get(ME_URL).subscribe();
    http.get(`${ME_URL}?other=1`).subscribe();

    const first = httpMock.expectOne(ME_URL);
    const second = httpMock.expectOne(`${ME_URL}?other=1`);
    first.flush(null, { status: 401, statusText: 'Unauthorized' });
    second.flush(null, { status: 401, statusText: 'Unauthorized' });

    await vi.waitFor(() => expect(auth.setAccessToken).toHaveBeenCalledTimes(1));

    expect(auth.refreshToken).toHaveBeenCalledTimes(1);

    const retriedFirst = await vi.waitFor(() => httpMock.expectOne(ME_URL));
    retriedFirst.flush({});
    const retriedSecond = await vi.waitFor(() => httpMock.expectOne(`${ME_URL}?other=1`));
    retriedSecond.flush({});
  });

  it('logs out when the refresh itself is rejected as unauthorized', async () => {
    setup('expired-token');
    auth.refreshToken.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' })),
    );

    let error: unknown;
    http.get(ME_URL).subscribe({ error: (err) => (error = err) });

    httpMock.expectOne(ME_URL).flush(null, { status: 401, statusText: 'Unauthorized' });

    await vi.waitFor(() => expect(auth.logout).toHaveBeenCalled());
    expect(auth.clearSession).not.toHaveBeenCalled();
    expect(error).toBeTruthy();
  });

  it('clears the session without logging out when the refresh fails for another reason', async () => {
    setup('expired-token');
    auth.refreshToken.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error' })),
    );

    let error: unknown;
    http.get(ME_URL).subscribe({ error: (err) => (error = err) });

    httpMock.expectOne(ME_URL).flush(null, { status: 401, statusText: 'Unauthorized' });

    await vi.waitFor(() => expect(auth.clearSession).toHaveBeenCalled());
    expect(auth.logout).not.toHaveBeenCalled();
    expect(error).toBeTruthy();
  });
});
