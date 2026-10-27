import { computed, Directive, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@app/core/services/auth/auth';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { AUTH_LINK_BUTTON, AUTH_MARK } from './auth-form-head';
import { readLinkToken } from './link-token.util';

export interface TokenLinkCopy {
  title: string;
  pending: string;
  success: string;
  noToken: string;
}

type TokenLinkStatus = 'pending' | 'success' | 'error' | 'no-token';

@Directive()
export abstract class TokenLinkPage {
  readonly linkButton = AUTH_LINK_BUTTON;
  readonly mark = AUTH_MARK;
  protected readonly auth = inject(AuthService);
  private readonly errorMessage = inject(ErrorMessageService);
  private readonly token = readLinkToken(inject(ActivatedRoute), inject(Router));

  abstract readonly copy: TokenLinkCopy;
  readonly status = signal<TokenLinkStatus>(this.token ? 'pending' : 'no-token');
  readonly errorText = signal('');
  readonly back = computed(() => ({ link: '/auth/login', label: 'auth.back_to_sign_in' }));

  protected abstract submit(token: string): Promise<unknown>;

  constructor() {
    if (this.token) void this.run(this.token);
  }

  private async run(token: string): Promise<void> {
    try {
      await this.submit(token);
      this.status.set('success');
    } catch (error) {
      this.errorText.set(this.errorMessage.fromApiError(error));
      this.status.set('error');
    }
  }
}
