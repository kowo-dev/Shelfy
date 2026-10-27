import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { StarRatingComponent } from '@shared/ui/star-rating/star-rating';
import {
  formatRating,
  ratingToTextColor,
  ratingVerdictKey,
} from '@shared/utils/collection-rating.util';

const RING_C = 2 * Math.PI * 33;
const MAX_STEP = 10;

@Component({
  selector: 'shelfy-rating-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, TranslatePipe, StarRatingComponent],
  templateUrl: './rating-picker.html',
  host: { class: '@container block' },
})
export class RatingPickerComponent {
  value = input<number | null>(null);
  toggle = input(false);

  readonly changed = output<number | null>();

  readonly previewRating = signal<number | null>(null);
  readonly shownRating = computed(() => this.previewRating() ?? this.value());
  readonly ratingColor = computed(() => {
    const rating = this.shownRating();
    return rating === null ? 'var(--color-text-subtle)' : ratingToTextColor(rating, 100);
  });
  readonly ringDash = computed(
    () => `${((this.shownRating() ?? 0) / MAX_STEP) * RING_C} ${RING_C}`,
  );
  readonly verdictKey = computed(() => ratingVerdictKey(this.shownRating()));
  protected readonly formatRating = formatRating;

  numberClass(shown: number | null): string {
    if (shown === null) return 'text-text-subtle';
    const size = formatRating(shown).includes('.')
      ? ' text-[2.25rem] leading-none @[30rem]:text-[3rem]'
      : '';
    return 'text-text' + size;
  }

  clear(): void {
    this.previewRating.set(null);
    this.changed.emit(null);
  }
}
