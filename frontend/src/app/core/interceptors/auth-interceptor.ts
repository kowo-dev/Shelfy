import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, firstValueFrom, from, switchMap, throwError } from 'rxjs';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { AuthService } from '@app/core/services/auth/auth';

const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

let refreshPromise: Promise<string | null> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const toast = inject(ToastService);
  const translate = inject(TranslateService);

  req = addCredentials(req);
  req = addAuthHeader(req, auth.accessToken());

  const hadSession = auth.isAuthenticated();

  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !isAuthRequest(req.url) &&
        hadSession
      ) {
        return handleUnauthorized(req, next, auth, () => {
          toast.warning(translate.get('auth.session_expired'));
        });
      }
      return throwError(() => error);
    }),
  );
};

function addCredentials<T>(req: HttpRequest<T>): HttpRequest<T> {
  return req.clone({ withCredentials: true });
}

function addAuthHeader<T>(req: HttpRequest<T>, token: string | null): HttpRequest<T> {
  if (!token || isAuthRequest(req.url) || req.headers.has('Authorization')) {
    return req;
  }
  return req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
}

function isAuthRequest(url: string): boolean {
  return AUTH_ENDPOINTS.some((endpoint) => url.endsWith(endpoint));
}

function isAuthRejection(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403);
}

function refreshSession(auth: AuthService, onSessionExpired: () => void): Promise<string> {
  return firstValueFrom(auth.refreshToken())
    .then((response) => {
      auth.setAccessToken(response.accessToken);
      return response.accessToken;
    })
    .catch(async (error) => {
      try {
        if (isAuthRejection(error)) {
          await auth.logout();
        } else {
          auth.clearSession();
        }
      } catch {
        auth.clearSession();
      } finally {
        onSessionExpired();
      }
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });
}

function handleUnauthorized<T>(
  req: HttpRequest<T>,
  next: (req: HttpRequest<T>) => ReturnType<HttpInterceptorFn>,
  auth: AuthService,
  onSessionExpired: () => void,
) {
  refreshPromise ??= refreshSession(auth, onSessionExpired);

  return from(refreshPromise).pipe(
    switchMap((newToken) => {
      if (!newToken) {
        return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }));
      }
      const retryReq = req.clone({
        withCredentials: true,
        setHeaders: { Authorization: `Bearer ${newToken}` },
      });
      return next(retryReq);
    }),
  );
}
