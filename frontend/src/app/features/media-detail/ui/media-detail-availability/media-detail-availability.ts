import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon';
import { steamStoreUrl } from '../../data-access/media-detail-links.util';
import { buttonClasses } from '@shared/ui/button/button';

@Component({
  selector: 'shelfy-media-detail-availability',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './media-detail-availability.html',
})
export class MediaDetailAvailabilityComponent {
  readonly pill = buttonClasses({ variant: 'secondary', size: 'sm' });
  readonly steamAppIds = input.required<string[]>();

  protected readonly steamStoreUrl = steamStoreUrl;
}
