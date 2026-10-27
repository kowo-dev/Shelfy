import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import type { UserMediaStatus } from '@app/core/services/collection/collection.model';
import {
  collectionStatusColor,
  collectionStatusIcon,
  statusLabelKey,
} from '@shared/utils/collection-status.util';

@Component({
  selector: 'shelfy-status-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TranslatePipe],
  templateUrl: './status-picker.html',
})
export class StatusPickerComponent {
  statuses = input.required<UserMediaStatus[]>();
  value = input<UserMediaStatus | null>(null);
  mediaType = input<string | null>(null);
  detail = input<string | null>(null);

  readonly picked = output<UserMediaStatus>();

  label(status: UserMediaStatus): string {
    return statusLabelKey(status, this.mediaType());
  }

  statusColor(status: UserMediaStatus): string {
    return collectionStatusColor(status);
  }

  statusIcon(status: UserMediaStatus): string {
    return collectionStatusIcon(status);
  }

  readonly focusIndex = computed(() => {
    const value = this.value();
    return Math.max(0, value ? this.statuses().indexOf(value) : 0);
  });

  onKeydown(event: KeyboardEvent): void {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    const buttons = [
      ...((event.currentTarget as HTMLElement)
        .closest('[role=radiogroup]')
        ?.querySelectorAll<HTMLButtonElement>('[role=radio]') ?? []),
    ];
    const index = buttons.indexOf(event.currentTarget as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next = buttons[(index + step + buttons.length) % buttons.length];
    next.focus();
  }
}
