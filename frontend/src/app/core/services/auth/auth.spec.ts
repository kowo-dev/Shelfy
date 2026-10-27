import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { environment } from '@env';
import type { AuthResponse, User } from './auth.model';
import { AuthService } from './auth';

const ME_URL = `${environment.baseUrl}/users/me`;
const REFRESH_URL = `${environment.baseUrl}/auth/refresh`;
const LOGIN_URL = `${environment.baseUrl}/auth/login`;
const LOGOUT_URL = `${environment.baseUrl}/auth/logout`;

function user(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    email: 'kowo@example.com',
    pendingEmail: null,
    username: 'kowo',
    displayName: null,
    bio: null,
    avatarUrl: null,
    profileBannerUrl: null,
    profileBannerTitle: null,
    profileBannerProvider: null,
    profileBannerSourceUrl: null,
    profileBannerPosition: null,
    profileVisibility: 'public',
    isAdultContentAllowed: false,
    hasConfirmedAdultContent: false,
    hasOptedOutOfFederation: false,
    isEmailVerified: true,
    isSteamConnected: false,
    steamDisplayName: null,
    isSteamAvailable: true,
    isAdmin: false,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function authResponse(accessToken = 'access-token'): AuthResponse {
  return { accessToken, tokenType: 'Bearer', expiresInSeconds: 900 };
}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let navigateByUrl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    navigateByUrl = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigateByUrl } },
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('starts unauthenticated with no current user', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.accessToken()).toBeNull();
    expect(service.currentUser()).toBeNull();
  });

  it('setAccessToken marks the service as authenticated', () => {
    service.setAccessToken('token-1');

    expect(service.accessToken()).toBe('token-1');
    expect(service.isAuthenticated()).toBe(true);
  });

  it('clearSession resets the access token and current user', () => {
    service.setAccessToken('token-1');

    service.clearSession();

    expect(service.accessToken()).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('redirects to /auth/login when the session transitions from authenticated to not', () => {
    service.setAccessToken('token-1');
    TestBed.flushEffects();
    expect(navigateByUrl).not.toHaveBeenCalled();

    service.clearSession();
    TestBed.flushEffects();

    expect(navigateByUrl).toHaveBeenCalledWith('/auth/login');
  });

  it('does not redirect on the very first construction (never authenticated)', () => {
    TestBed.flushEffects();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('init() restores the session by refreshing the token and loading the current user', async () => {
    const initPromise = service.init();

    httpMock.expectOne(REFRESH_URL).flush(authResponse('restored-token'));
    (await vi.waitFor(() => httpMock.expectOne(ME_URL))).flush(user({ username: 'kowo' }));

    await initPromise;

    expect(service.accessToken()).toBe('restored-token');
    expect(service.currentUser()?.username).toBe('kowo');
  });

  it('init() clears the session when the refresh fails (no valid session cookie)', async () => {
    const initPromise = service.init();

    httpMock.expectOne(REFRESH_URL).flush(null, { status: 401, statusText: 'Unauthorized' });

    await initPromise;

    expect(service.accessToken()).toBeNull();
    expect(service.currentUser()).toBeNull();
    httpMock.expectNone(ME_URL);
  });

  it('init() loads the current user directly when an access token is already set', async () => {
    service.setAccessToken('already-set');

    const initPromise = service.init();

    httpMock.expectOne(ME_URL).flush(user({ username: 'kowo' }));

    await initPromise;

    httpMock.expectNone(REFRESH_URL);
    expect(service.currentUser()?.username).toBe('kowo');
  });

  it('login() authenticates and loads the current user', async () => {
    const loginPromise = service.login({ email: 'kowo@example.com', password: 'secret' });

    httpMock.expectOne(LOGIN_URL).flush(authResponse('login-token'));
    (await vi.waitFor(() => httpMock.expectOne(ME_URL))).flush(user({ username: 'kowo' }));

    const result = await loginPromise;

    expect(service.accessToken()).toBe('login-token');
    expect(service.currentUser()?.username).toBe('kowo');
    expect(result.username).toBe('kowo');
  });

  it('logout() clears the session after the backend call succeeds', async () => {
    service.setAccessToken('token-1');

    const logoutPromise = service.logout();

    httpMock.expectOne(LOGOUT_URL).flush(null);

    await logoutPromise;

    expect(service.accessToken()).toBeNull();
    expect(service.currentUser()).toBeNull();
  });

  it('refreshCurrentUser() updates the current user signal', async () => {
    const refreshPromise = service.refreshCurrentUser();

    httpMock.expectOne(ME_URL).flush(user({ username: 'updated' }));

    const result = await refreshPromise;

    expect(result.username).toBe('updated');
    expect(service.currentUser()?.username).toBe('updated');
  });

  it('deleteAccount() sends the password with the delete request', async () => {
    const deletePromise = service.deleteAccount('secret-password');

    const req = httpMock.expectOne(ME_URL);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ password: 'secret-password' });
    req.flush(null);
    await Promise.resolve();
    httpMock.expectOne(LOGOUT_URL).flush(null);

    await deletePromise;
  });

  it('logout() still clears the session and redirects when the backend call fails', async () => {
    service.setAccessToken('token-1');
    TestBed.tick();

    const logoutPromise = service.logout();
    const assertion = expect(logoutPromise).rejects.toBeDefined();
    httpMock.expectOne(LOGOUT_URL).flush(null, { status: 500, statusText: 'Server Error' });
    await assertion;
    TestBed.tick();

    expect(service.accessToken()).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(navigateByUrl).toHaveBeenCalledWith('/auth/login');
  });

  it('login() with bad credentials stays unauthenticated and propagates the error', async () => {
    const loginPromise = service.login({ email: 'kowo@example.com', password: 'wrong' });
    const assertion = expect(loginPromise).rejects.toBeDefined();

    httpMock.expectOne(LOGIN_URL).flush(null, { status: 401, statusText: 'Unauthorized' });
    await assertion;

    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    httpMock.expectNone(ME_URL);
  });

  it('login() drops the token when the user cannot be loaded', async () => {
    const loginPromise = service.login({ email: 'kowo@example.com', password: 'secret' });
    const assertion = expect(loginPromise).rejects.toBeDefined();

    httpMock.expectOne(LOGIN_URL).flush(authResponse('login-token'));
    (await vi.waitFor(() => httpMock.expectOne(ME_URL))).flush(null, {
      status: 500,
      statusText: 'Server Error',
    });
    await assertion;

    expect(service.accessToken()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('init() clears the session when the refreshed token cannot load the user', async () => {
    const initPromise = service.init();

    httpMock.expectOne(REFRESH_URL).flush(authResponse('refreshed'));
    (await vi.waitFor(() => httpMock.expectOne(ME_URL))).flush(null, {
      status: 401,
      statusText: 'Unauthorized',
    });
    await initPromise;

    expect(service.accessToken()).toBeNull();
    expect(service.currentUser()).toBeNull();
  });

  it('deleteAccount() keeps the session when the password is rejected', async () => {
    service.setAccessToken('token-1');

    const deletePromise = service.deleteAccount('wrong');
    const assertion = expect(deletePromise).rejects.toBeDefined();

    httpMock.expectOne(ME_URL).flush(null, { status: 403, statusText: 'Forbidden' });
    await assertion;

    expect(service.accessToken()).toBe('token-1');
    httpMock.expectNone(LOGOUT_URL);
  });

  it.each<[string, (s: AuthService) => Promise<unknown>, string, string]>([
    [
      'register',
      (s) => s.register({ email: 'a@b.c', username: 'kowo', password: 'secret' }),
      'auth/register',
      'POST',
    ],
    ['verifyEmail', (s) => s.verifyEmail({ token: 't' }), 'auth/verify-email', 'POST'],
    [
      'resendVerification',
      (s) => s.resendVerification({ email: 'a@b.c' }),
      'auth/resend-verification',
      'POST',
    ],
    ['forgotPassword', (s) => s.forgotPassword({ email: 'a@b.c' }), 'auth/forgot-password', 'POST'],
    [
      'resetPassword',
      (s) => s.resetPassword({ token: 't', newPassword: 'secret' }),
      'auth/reset-password',
      'POST',
    ],
  ])('%s calls its endpoint without touching the session', async (_name, call, path, method) => {
    const promise = call(service);

    const req = httpMock.expectOne(`${environment.baseUrl}/${path}`);
    expect(req.request.method).toBe(method);
    req.flush(null);
    await promise;

    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  it.each<[string, (s: AuthService) => Promise<User>, string, string]>([
    [
      'updateProfile',
      (s) =>
        s.updateProfile({
          username: 'kowo',
          displayName: 'Kowo',
          bio: null,
          profileVisibility: 'public',
          isAdultContentAllowed: false,
          confirmAdultContent: false,
        }),
      'PATCH',
      ME_URL,
    ],
    [
      'updateProfileBanner',
      (s) =>
        s.updateProfileBanner({
          bannerUrl: 'b.jpg',
          title: 'Dune',
          provider: 'tmdb',
          sourceUrl: 'https://example.com',
          position: 50,
        }),
      'PATCH',
      `${ME_URL}/profile-banner`,
    ],
    ['clearProfileBanner', (s) => s.clearProfileBanner(), 'DELETE', `${ME_URL}/profile-banner`],
    ['uploadAvatar', (s) => s.uploadAvatar(new File(['x'], 'a.png')), 'POST', `${ME_URL}/avatar`],
    ['removeAvatar', (s) => s.removeAvatar(), 'DELETE', `${ME_URL}/avatar`],
  ])('%s replaces the current user with the saved one', async (_name, call, method, url) => {
    const promise = call(service);

    httpMock.expectOne({ method, url }).flush(user({ username: 'saved' }));

    expect((await promise).username).toBe('saved');
    expect(service.currentUser()?.username).toBe('saved');
  });

  it('uploadAvatar sends the file as multipart form data', async () => {
    const file = new File(['x'], 'a.png');
    const promise = service.uploadAvatar(file);

    const req = httpMock.expectOne(`${ME_URL}/avatar`);
    expect((req.request.body as FormData).get('file')).toBe(file);
    req.flush(user());
    await promise;
  });

  it('requestEmailChange reloads the user to show the pending address', async () => {
    const promise = service.requestEmailChange({ newEmail: 'new@b.c' });

    httpMock.expectOne(`${ME_URL}/email/change-request`).flush(null);
    (await vi.waitFor(() => httpMock.expectOne(ME_URL))).flush(user({ pendingEmail: 'new@b.c' }));
    await promise;

    expect(service.currentUser()?.pendingEmail).toBe('new@b.c');
  });

  it('confirmEmailChange reloads the user only when signed in', async () => {
    const guest = service.confirmEmailChange({ token: 't' });
    httpMock.expectOne(`${environment.baseUrl}/auth/confirm-email-change`).flush(user());
    await guest;
    httpMock.expectNone(ME_URL);

    service.setAccessToken('token-1');
    const signedIn = service.confirmEmailChange({ token: 't' });
    httpMock.expectOne(`${environment.baseUrl}/auth/confirm-email-change`).flush(user());
    (await vi.waitFor(() => httpMock.expectOne(ME_URL))).flush(user({ email: 'new@b.c' }));
    await signedIn;

    expect(service.currentUser()?.email).toBe('new@b.c');
  });

  it('exportData downloads the export as a JSON file and frees the blob url', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:export');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    const promise = service.exportData();
    httpMock.expectOne(`${ME_URL}/export`).flush(new Blob(['{}']));
    await promise;

    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe('shelfy-data-export.json');
    expect(link.getAttribute('href')).toBe('blob:export');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export');
    vi.unstubAllGlobals();
    click.mockRestore();
  });

  it('checkUsernameAvailability sends the candidate as a query param', () => {
    service.checkUsernameAvailability('kowo').subscribe();

    const req = httpMock.expectOne((r) => r.url === `${ME_URL}/username-availability`);
    expect(req.request.params.get('value')).toBe('kowo');
    req.flush({ isAvailable: true });
  });
});
