import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import { formatRating, ratingToTextColor } from '@shared/utils/collection-rating.util';

const THUMB =
  'pointer-events-none absolute inset-0 m-0 h-8.5 w-full cursor-grab appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[0_2px_8px_rgb(0_0_0/0.5)] [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgb(0_0_0/0.5)] focus-visible:outline-none focus-visible:[&::-moz-range-thumb]:shadow-[0_0_0_3px_var(--color-brand-ink)] focus-visible:[&::-webkit-slider-thumb]:shadow-[0_0_0_3px_var(--color-brand-ink)]';

@Component({
  selector: 'shelfy-rating-range',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IconComponent],
  template: `
    <div class="flex items-center justify-between px-3">
      <span class="text-text-subtle flex items-center gap-1 text-xs font-semibold"
        ><shelfy-icon name="star" size="12" [active]="true" />{{ label() }}</span
      >
      <b class="text-text text-base font-semibold tabular-nums"
        >{{ format(low()) }} – {{ format(high()) }}</b
      >
    </div>
    <div
      class="relative mx-0.5 mt-1.5 h-8.5"
      [style.--lo]="percent(low())"
      [style.--hi]="percent(high())"
    >
      <span class="bg-fill-strong absolute inset-x-0 top-[15px] h-1 rounded-sm" aria-hidden="true">
        <span
          class="absolute inset-y-0 right-[calc(100%-var(--hi))] left-(--lo) rounded-sm"
          [style.background]="fill()"
        ></span>
      </span>
      <input
        type="range"
        min="1"
        max="10"
        step="1"
        [class]="thumb"
        [value]="low()"
        [attr.aria-label]="'collection.filters.rating_min' | translate"
        [attr.aria-valuetext]="format(low())"
        (input)="move('low', $event)"
        (change)="commit()"
      />
      <input
        type="range"
        min="1"
        max="10"
        step="1"
        [class]="thumb"
        [value]="high()"
        [attr.aria-label]="'collection.filters.rating_max' | translate"
        [attr.aria-valuetext]="format(high())"
        (input)="move('high', $event)"
        (change)="commit()"
      />
    </div>
    <div class="text-text-subtle mx-2.5 mt-0.5 flex justify-between text-xs" aria-hidden="true">
      @for (star of [1, 2, 3, 4, 5]; track star) {
        <span>{{ star }}</span>
      }
    </div>
  `,
  host: { class: 'block' },
})
export class RatingRangeComponent {
  label = input.required<string>();
  from = input(1);
  to = input(10);

  readonly changed = output<{ from: number; to: number }>();

  protected readonly thumb = THUMB;
  protected readonly format = formatRating;

  readonly low = linkedSignal(() => this.from());
  readonly high = linkedSignal(() => this.to());
  readonly fill = computed(() => ratingToTextColor(this.high(), 100));

  percent(value: number): string {
    return `${((value - 1) / 9) * 100}%`;
  }

  move(thumb: 'low' | 'high', event: Event): void {
    const input = event.target as HTMLInputElement;
    const value =
      thumb === 'low'
        ? Math.min(Number(input.value), this.high())
        : Math.max(Number(input.value), this.low());
    input.value = String(value);
    (thumb === 'low' ? this.low : this.high).set(value);
  }

  commit(): void {
    if (this.low() === this.from() && this.high() === this.to()) return;
    this.changed.emit({ from: this.low(), to: this.high() });
  }
}
