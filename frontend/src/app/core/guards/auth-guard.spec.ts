import { TestBed } from '@angular/core/testing';
import { Router, type UrlTree } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '@app/core/services/auth/auth';
import { AuthPromptService } from '@app/core/services/auth/auth-prompt';
import { authGuard } from './auth-guard';

describe('authGuard', () => {
  function setup(isAuthenticated: boolean) {
    const urlTree = {} as UrlTree;
    const createUrlTree = vi.fn().mockReturnValue(urlTree);
    const show = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isAuthenticated: () => isAuthenticated } },
        { provide: AuthPromptService, useValue: { show } },
        { provide: Router, useValue: { createUrlTree } },
      ],
    });
    return { createUrlTree, urlTree, show };
  }

  it('allows activation when authenticated', () => {
    const { show } = setup(true);

    const result = TestBed.runInInjectionContext(() =>
      authGuard(null as never, { url: '/collection' } as never),
    );

    expect(result).toBe(true);
    expect(show).not.toHaveBeenCalled();
  });

  it('redirects to /discover and preserves the requested url in the login prompt', () => {
    const { createUrlTree, urlTree, show } = setup(false);

    const result = TestBed.runInInjectionContext(() =>
      authGuard(null as never, { url: '/lists/new' } as never),
    );

    expect(show).toHaveBeenCalledWith('/lists/new');
    expect(createUrlTree).toHaveBeenCalledWith(['/discover']);
    expect(result).toBe(urlTree);
  });
});
