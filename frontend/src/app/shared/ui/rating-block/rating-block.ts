import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { RatingSliderComponent } from '@shared/ui/rating-slider/rating-slider';
import { RatingWheelComponent } from '@shared/ui/rating-wheel/rating-wheel';
import {
  formatRating,
  ratingToTextColor,
  ratingVerdictKey,
} from '@shared/utils/collection-rating.util';

@Component({
  selector: 'shelfy-rating-block',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RatingSliderComponent, RatingWheelComponent],
  host: { class: 'block' },
  template: `
    <div [attr.aria-label]="'collection.sheet.rating' | translate">
      <shelfy-rating-wheel
        class="sm:hidden"
        [value]="value()"
        [label]="'collection.sheet.rating' | translate"
        (changed)="changed.emit($event)"
      />
      <p
        class="mt-1 text-center text-[0.9375rem] font-semibold transition-colors sm:hidden"
        [style.color]="numberColor()"
        aria-hidden="true"
      >
        {{ verdictKey() | translate }}
      </p>
      <div class="rating-row rating-row-desktop">
        <shelfy-rating-slider
          size="lg"
          tone="white"
          [value]="value()"
          [label]="'collection.sheet.rating' | translate"
          (changed)="changed.emit($event)"
          (previewed)="preview.set($event)"
        />
        <span class="rating-value is-large" [style.color]="numberColor()" aria-hidden="true">
          @for (shown of [ratingText()]; track shown) {
            <b animate.enter="animate-count-in" [class.invisible]="shownRating() === null">{{
              shown
            }}</b>
          }
          <span>{{ verdictKey() | translate }}</span>
        </span>
      </div>
    </div>
  `,
})
export class RatingBlockComponent {
  readonly value = input<number | null>(null);
  readonly changed = output<number | null>();

  readonly preview = signal<number | null>(null);
  readonly shownRating = computed(() => this.preview() ?? this.value());
  readonly ratingText = computed(() => {
    const rating = this.shownRating();
    return rating === null ? '–' : formatRating(rating);
  });
  readonly verdictKey = computed(() => ratingVerdictKey(this.shownRating()));
  readonly numberColor = computed(() => {
    const rating = this.shownRating();
    return rating === null ? 'var(--color-text-subtle)' : ratingToTextColor(rating, 55);
  });
}
