import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { RatingSliderComponent } from '@shared/ui/rating-slider/rating-slider';
import { StarRatingComponent } from '@shared/ui/star-rating/star-rating';
import {
  formatRating,
  ratingToTextColor,
  ratingVerdictKey,
} from '@shared/utils/collection-rating.util';

@Component({
  selector: 'shelfy-rating-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RatingSliderComponent, StarRatingComponent, TranslatePipe],
  host: { class: 'block min-w-0' },
  template: `
    <p
      class="text-text-subtle relative grid h-4 overflow-hidden text-xs font-semibold"
      aria-hidden="true"
    >
      @for (verdict of [verdictKey()]; track verdict) {
        <span
          class="col-start-1 row-start-1 truncate"
          animate.enter="animate-count-in"
          animate.leave="animate-count-out"
          >{{ verdict | translate }}</span
        >
      }
    </p>
    <div class="mt-1 flex min-h-11 min-w-0 items-center gap-3">
      @if (readonly()) {
        <span class="sr-only">{{ label() }} {{ text() }}</span>
      }
      <div class="contents" [attr.inert]="readonly() ? '' : null">
        <shelfy-rating-slider
          class="sm:hidden"
          size="md"
          [value]="value()"
          [label]="label()"
          (changed)="changed.emit($event)"
          (previewed)="preview.set($event)"
        />
        <shelfy-star-rating
          class="max-sm:hidden"
          size="md"
          [value]="value()"
          [toggle]="true"
          [label]="label()"
          (changed)="changed.emit($event)"
          (previewed)="preview.set($event)"
        />
      </div>
      <span
        class="font-display relative grid h-[1.1em] w-14 shrink-0 overflow-hidden text-xl leading-none font-extrabold tabular-nums max-sm:text-[2.125rem]"
        aria-hidden="true"
      >
        @for (shown of [text()]; track shown) {
          <b
            class="col-start-1 row-start-1 self-center transition-colors"
            [class.text-text-subtle]="color() === null"
            [style.color]="color()"
            animate.enter="animate-count-in"
            animate.leave="animate-count-out"
            >{{ shown }}</b
          >
        }
      </span>
      <ng-content />
    </div>
  `,
})
export class RatingFieldComponent {
  readonly value = input<number | null>(null);
  readonly label = input<string | null>(null);
  readonly readonly = input(false);

  readonly changed = output<number | null>();

  readonly preview = signal<number | null>(null);
  private readonly shown = computed(() => this.preview() ?? this.value());
  readonly text = computed(() => {
    const rating = this.shown();
    return rating === null ? '–' : formatRating(rating);
  });
  readonly color = computed(() => {
    const rating = this.shown();
    return rating === null ? null : ratingToTextColor(rating, 100);
  });
  readonly verdictKey = computed(() => ratingVerdictKey(this.shown()));
}
