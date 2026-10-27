import { TestBed } from '@angular/core/testing';
import { Router, type UrlTree } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '@app/core/services/auth/auth';
import { guestGuard } from './guest-guard';

describe('guestGuard', () => {
  function setup(isAuthenticated: boolean, signingOut = false) {
    const urlTree = {} as UrlTree;
    const createUrlTree = vi.fn().mockReturnValue(urlTree);
    const currentNavigation = () => (signingOut ? { extras: { state: { signingOut } } } : null);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isAuthenticated: () => isAuthenticated } },
        { provide: Router, useValue: { createUrlTree, currentNavigation } },
      ],
    });
    return { createUrlTree, urlTree };
  }

  it('allows activation when not authenticated', () => {
    setup(false);

    const result = TestBed.runInInjectionContext(() => guestGuard(null as never, null as never));

    expect(result).toBe(true);
  });

  it('redirects to /discover when already authenticated', () => {
    const { createUrlTree, urlTree } = setup(true);

    const result = TestBed.runInInjectionContext(() => guestGuard(null as never, null as never));

    expect(createUrlTree).toHaveBeenCalledWith(['/discover']);
    expect(result).toBe(urlTree);
  });

  it('lets a signing-out user reach the login page before the session is cleared', () => {
    setup(true, true);

    const result = TestBed.runInInjectionContext(() => guestGuard(null as never, null as never));

    expect(result).toBe(true);
  });
});
