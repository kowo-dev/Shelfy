import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ProfileConnectionsPageComponent } from '../profile-connections/profile-connections';
import { DEV_PROFILE_PROVIDERS } from './dev-profile';

@Component({
  selector: 'shelfy-dev-connections',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProfileConnectionsPageComponent],
  providers: DEV_PROFILE_PROVIDERS,
  template: '<shelfy-profile-connections-page />',
})
export class DevConnectionsPageComponent {}
