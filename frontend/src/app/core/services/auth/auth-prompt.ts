import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth';

export class AuthRequiredError extends Error {
  constructor() {
    super('Authentication required');
    this.name = 'AuthRequiredError';
  }
}

@Injectable({ providedIn: 'root' })
export class AuthPromptService {
  private readonly auth = inject(AuthService);

  readonly isOpen = signal(false);
  readonly returnUrl = signal<string | null>(null);
  readonly remoteFollow = signal<string | null>(null);

  show(returnUrl: string | null = null, remoteFollow: string | null = null): void {
    this.returnUrl.set(returnUrl);
    this.remoteFollow.set(remoteFollow);
    this.isOpen.set(true);
  }

  hide(): void {
    this.isOpen.set(false);
    this.returnUrl.set(null);
    this.remoteFollow.set(null);
  }

  require(): boolean {
    if (this.auth.isAuthenticated()) {
      return true;
    }
    this.show();
    return false;
  }
}
