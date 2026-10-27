import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import type { MediaType, UserMediaStatus } from '@app/core/services/collection/collection.model';
import { RatingBlockComponent } from '@shared/ui/rating-block/rating-block';
import { StatusPickerComponent } from '@shared/ui/item-sheet/ui/status-picker/status-picker';
import { PROGRESS_STATUSES } from '@shared/utils/collection-status.util';

@Component({
  selector: 'shelfy-item-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, StatusPickerComponent, RatingBlockComponent],
  host: { class: 'block' },
  template: `
    <section
      class="animate-rise-in flex flex-col gap-7 pt-2 sm:gap-8"
      [style.animation-delay.ms]="140"
      [attr.aria-label]="'collection.status_label' | translate"
    >
      <shelfy-rating-block
        class="max-sm:order-last"
        [value]="rating()"
        (changed)="ratingChanged.emit($event)"
      />
      <shelfy-status-picker
        [statuses]="statuses"
        [mediaType]="mediaType()"
        [value]="status()"
        (picked)="statusPicked.emit($event)"
      />
    </section>
  `,
})
export class ItemEditorComponent {
  readonly mediaType = input.required<MediaType>();
  readonly status = input<UserMediaStatus | null>(null);
  readonly rating = input<number | null>(null);

  readonly statusPicked = output<UserMediaStatus>();
  readonly ratingChanged = output<number | null>();

  readonly statuses: UserMediaStatus[] = [...PROGRESS_STATUSES, 'planned'];
}
