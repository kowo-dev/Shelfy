import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LegalService } from '@app/core/services/legal/legal';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { LegalShellComponent } from '../legal-shell';

@Component({
  selector: 'shelfy-terms-of-service-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, LegalShellComponent],
  templateUrl: './terms-of-service.html',
})
export class TermsOfServicePageComponent {
  private readonly legalService = inject(LegalService);

  readonly contactEmail = signal('—');

  constructor() {
    this.legalService.getInfo().subscribe({
      next: (info) => {
        this.contactEmail.set(info.contactEmail ?? '—');
      },
    });
  }
}
