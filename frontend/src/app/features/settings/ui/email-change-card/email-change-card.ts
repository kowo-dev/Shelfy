import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { InputComponent } from '@shared/ui/input/input';
import { collapse } from '@app/shared/ui/ui-recipes';
import type { SettingsEmailForm } from '../../state/settings-email-state';
import { buttonClasses } from '@shared/ui/button/button';

@Component({
  selector: 'shelfy-email-change-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InputComponent, ReactiveFormsModule, TranslatePipe],
  templateUrl: './email-change-card.html',
  host: { class: 'block' },
})
export class EmailChangeCardComponent {
  readonly pill = buttonClasses({ variant: 'secondary', extraClass: 'w-fit shrink-0' });
  readonly primary = buttonClasses({ variant: 'primary' });
  readonly collapse = collapse;
  readonly open = signal(false);

  email = input.required<string>();
  pendingEmail = input<string | null>(null);
  emailVerified = input.required<boolean>();
  form = input.required<SettingsEmailForm>();
  newEmailError = input.required<string>();
  sending = input.required<boolean>();

  requestChange = output<void>();
}
