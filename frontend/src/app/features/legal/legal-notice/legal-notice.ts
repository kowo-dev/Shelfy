import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LegalService } from '@app/core/services/legal/legal';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { LegalShellComponent } from '../legal-shell';

@Component({
  selector: 'shelfy-legal-notice-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, LegalShellComponent],
  templateUrl: './legal-notice.html',
})
export class LegalNoticePageComponent {
  private readonly legalService = inject(LegalService);

  readonly controllerName = signal('—');
  readonly contactEmail = signal('—');
  readonly hostingProviderName = signal('—');
  readonly hostingProviderAddress = signal('—');

  constructor() {
    this.legalService.getInfo().subscribe({
      next: (info) => {
        this.controllerName.set(info.controllerName ?? '—');
        this.contactEmail.set(info.contactEmail ?? '—');
        this.hostingProviderName.set(info.hostingProviderName ?? '—');
        this.hostingProviderAddress.set(info.hostingProviderAddress ?? '—');
      },
    });
  }
}
