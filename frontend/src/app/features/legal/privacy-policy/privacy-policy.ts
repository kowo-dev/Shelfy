import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LegalService } from '@app/core/services/legal/legal';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { LegalShellComponent } from '../legal-shell';

@Component({
  selector: 'shelfy-privacy-policy-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, LegalShellComponent],
  templateUrl: './privacy-policy.html',
})
export class PrivacyPolicyPageComponent {
  private readonly legalService = inject(LegalService);

  readonly controllerName = signal('—');
  readonly contactEmail = signal('—');
  readonly jurisdiction = signal('—');
  readonly federationEnabled = signal(false);

  constructor() {
    this.legalService.getInfo().subscribe({
      next: (info) => {
        this.controllerName.set(info.controllerName ?? '—');
        this.contactEmail.set(info.contactEmail ?? '—');
        this.jurisdiction.set(info.jurisdiction ?? '—');
        this.federationEnabled.set(info.isFederationEnabled === true);
      },
    });
  }
}
