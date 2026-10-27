import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '@app/core/services/auth/auth';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { TranslateService } from '@app/core/services/translate/translate';
import { ApiError } from '@app/core/errors/api-error';

import { VerifyEmailComponent } from './verify-email';

describe('VerifyEmailComponent', () => {
  let auth: { verifyEmail: ReturnType<typeof vi.fn> };
  let errorMessage: { fromApiError: ReturnType<typeof vi.fn> };

  function configure(queryParams: Record<string, string> = {}, fragment = '') {
    auth = { verifyEmail: vi.fn() };
    errorMessage = { fromApiError: vi.fn().mockReturnValue('Something went wrong') };

    return TestBed.configureTestingModule({
      imports: [VerifyEmailComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ErrorMessageService, useValue: errorMessage },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              fragment,
              queryParamMap: convertToParamMap(queryParams),
            },
          },
        },
      ],
    }).compileComponents();
  }

  it('starts in the no-token state when the URL has no token', async () => {
    await configure({});
    auth.verifyEmail.mockResolvedValue(undefined);

    const fixture = TestBed.createComponent(VerifyEmailComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.status()).toBe('no-token');
    expect(auth.verifyEmail).not.toHaveBeenCalled();
  });

  it('clears the URL and auto-verifies when a query-param token is present', async () => {
    await configure({ token: 'verify-token' });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    auth.verifyEmail.mockResolvedValue(undefined);

    const fixture = TestBed.createComponent(VerifyEmailComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: {} }));
    expect(auth.verifyEmail).toHaveBeenCalledWith({ token: 'verify-token' });
    expect(fixture.componentInstance.status()).toBe('success');
  });

  it('reads the token from the URL fragment', async () => {
    await configure({}, 'token=fragment-token');
    auth.verifyEmail.mockResolvedValue(undefined);

    const fixture = TestBed.createComponent(VerifyEmailComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(auth.verifyEmail).toHaveBeenCalledWith({ token: 'fragment-token' });
  });

  it('goes to the error state when verification fails', async () => {
    await configure({ token: 'expired-token' });
    auth.verifyEmail.mockRejectedValue(
      new ApiError(400, 'Token invalid', 'EMAIL_VERIFICATION_TOKEN_INVALID'),
    );
    errorMessage.fromApiError.mockReturnValue('auth.errors.verification_token_invalid');

    const fixture = TestBed.createComponent(VerifyEmailComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.status()).toBe('error');
    expect(fixture.componentInstance.errorText()).toBe('auth.errors.verification_token_invalid');
  });
});
