import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon';
import { formatRating } from '@shared/utils/collection-rating.util';

@Component({
  selector: 'shelfy-rating-value',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { class: 'inline-flex shrink-0 items-baseline gap-1.5 tabular-nums' },
  template: `
    <span class="inline-flex items-baseline gap-1" [style.color]="color()">
      <shelfy-icon name="star" [active]="true" [size]="starSize()" class="shrink-0 self-center" />
      <span>{{ text() }}</span>
    </span>
    @if (label(); as source) {
      <span class="tracking-label text-text-subtle text-xs uppercase">{{ source }}</span>
    }
  `,
})
export class RatingValueComponent {
  readonly value = input.required<number>();
  readonly color = input<string | null>(null);
  readonly label = input<string | null>(null);
  readonly starSize = input('14');

  protected readonly text = computed(() => formatRating(this.value()));
}
