import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@app/core/services/auth/auth';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { buttonClasses } from '@shared/ui/button/button';

@Component({
  selector: 'shelfy-not-found-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './not-found.html',
})
export class NotFoundPageComponent {
  readonly signedIn = inject(AuthService).isAuthenticated;
  readonly buttonClass = buttonClasses({ variant: 'primary' });
}
