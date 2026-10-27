import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import { TokenLinkPage } from '../token-link-page';

@Component({
  selector: 'shelfy-verify-email',
  templateUrl: '../token-link-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, IconComponent],
})
export class VerifyEmailComponent extends TokenLinkPage {
  readonly copy = {
    title: 'auth.verify_email',
    pending: 'auth.verify_email_verifying',
    success: 'auth.verify_email_success',
    noToken: 'auth.verify_email_no_token',
  };

  protected submit(token: string): Promise<unknown> {
    return this.auth.verifyEmail({ token });
  }
}
