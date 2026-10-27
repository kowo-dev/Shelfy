import type { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@app/core/services/auth/auth';
import { AuthPromptService } from '@app/core/services/auth/auth-prompt';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const authPrompt = inject(AuthPromptService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  authPrompt.show(state.url);
  return router.createUrlTree(['/discover']);
};
