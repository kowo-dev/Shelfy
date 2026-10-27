import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { SettingsRowComponent } from '@shared/ui/settings-row/settings-row';
import { buttonClasses } from '@shared/ui/button/button';
import { SETTINGS_ROWS } from '@shared/ui/ui-recipes';

@Component({
  selector: 'shelfy-danger-zone-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, SettingsRowComponent],
  templateUrl: './danger-zone-card.html',
  host: { class: 'block' },
})
export class DangerZoneCardComponent {
  readonly danger = buttonClasses({ variant: 'danger' });
  readonly rows = SETTINGS_ROWS;

  clearCollection = output<void>();
  deleteAccount = output<void>();
}
