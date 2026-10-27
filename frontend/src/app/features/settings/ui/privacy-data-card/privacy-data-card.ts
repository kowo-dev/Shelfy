import { IconComponent } from '@shared/ui/icon/icon';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { SpinnerComponent } from '@app/shared/ui/spinner/spinner';
import { SettingsRowComponent } from '@shared/ui/settings-row/settings-row';
import { buttonClasses } from '@shared/ui/button/button';
import { SETTINGS_ROWS, SETTINGS_TILE } from '@shared/ui/ui-recipes';

@Component({
  selector: 'shelfy-privacy-data-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RouterLink, SpinnerComponent, SettingsRowComponent, IconComponent],
  templateUrl: './privacy-data-card.html',
  host: { class: 'block' },
})
export class PrivacyDataCardComponent {
  readonly pill = buttonClasses({ variant: 'secondary' });
  readonly tile = SETTINGS_TILE;
  readonly rows = SETTINGS_ROWS;
  readonly legal = [
    { route: '/legal/privacy-policy', label: 'settings.privacy.policy_link' },
    { route: '/legal/terms', label: 'auth.terms_of_service' },
    { route: '/legal/notice', label: 'legal.notice.title' },
  ];

  exporting = input(false);
  exportData = output<void>();
}
