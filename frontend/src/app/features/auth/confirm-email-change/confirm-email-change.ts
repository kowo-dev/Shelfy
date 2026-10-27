import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import { TokenLinkPage } from '../token-link-page';

@Component({
  selector: 'shelfy-confirm-email-change',
  templateUrl: '../token-link-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, IconComponent],
})
export class ConfirmEmailChangeComponent extends TokenLinkPage {
  readonly copy = {
    title: 'auth.confirm_email_change',
    pending: 'auth.confirm_email_change_confirming',
    success: 'auth.confirm_email_change_success',
    noToken: 'auth.confirm_email_change_no_token',
  };
  readonly isAuthenticated = this.auth.isAuthenticated;
  override readonly back = computed(() =>
    this.isAuthenticated()
      ? { link: '/settings', label: 'settings.title' }
      : { link: '/auth/login', label: 'auth.back_to_sign_in' },
  );

  protected submit(token: string): Promise<unknown> {
    return this.auth.confirmEmailChange({ token });
  }
}
