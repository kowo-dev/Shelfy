import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '@app/core/services/auth/auth';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { TranslateService } from '@app/core/services/translate/translate';
import { ApiError } from '@app/core/errors/api-error';

import { ConfirmEmailChangeComponent } from './confirm-email-change';

describe('ConfirmEmailChangeComponent', () => {
  let auth: {
    confirmEmailChange: ReturnType<typeof vi.fn>;
    isAuthenticated: ReturnType<typeof signal<boolean>>;
  };
  let errorMessage: { fromApiError: ReturnType<typeof vi.fn> };

  function configure(queryParams: Record<string, string> = {}, fragment = '') {
    auth = {
      confirmEmailChange: vi.fn(),
      isAuthenticated: signal(false),
    };
    errorMessage = { fromApiError: vi.fn().mockReturnValue('Something went wrong') };

    return TestBed.configureTestingModule({
      imports: [ConfirmEmailChangeComponent],
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

    const fixture = TestBed.createComponent(ConfirmEmailChangeComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.status()).toBe('no-token');
    expect(auth.confirmEmailChange).not.toHaveBeenCalled();
  });

  it('clears the URL and auto-confirms when a token is present', async () => {
    await configure({ token: 'change-token' });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    auth.confirmEmailChange.mockResolvedValue(undefined);

    const fixture = TestBed.createComponent(ConfirmEmailChangeComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: {} }));
    expect(auth.confirmEmailChange).toHaveBeenCalledWith({ token: 'change-token' });
    expect(fixture.componentInstance.status()).toBe('success');
  });

  it('goes to the error state when confirmation fails', async () => {
    await configure({ token: 'expired-token' });
    auth.confirmEmailChange.mockRejectedValue(
      new ApiError(400, 'Token invalid', 'EMAIL_CHANGE_TOKEN_INVALID'),
    );
    errorMessage.fromApiError.mockReturnValue('auth.errors.email_change_token_invalid');

    const fixture = TestBed.createComponent(ConfirmEmailChangeComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.status()).toBe('error');
    expect(fixture.componentInstance.errorText()).toBe('auth.errors.email_change_token_invalid');
  });

  it('exposes isAuthenticated from the auth service for the link target', async () => {
    await configure({});
    auth.isAuthenticated.set(true);

    const fixture = TestBed.createComponent(ConfirmEmailChangeComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.isAuthenticated()).toBe(true);
  });
});
