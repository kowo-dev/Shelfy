import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatRating, ratingToTextColor } from '@shared/utils/collection-rating.util';

const RADIUS = 17;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

@Component({
  selector: 'shelfy-rating-ring',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 40 40" class="absolute inset-0.5 -rotate-90" aria-hidden="true">
      <circle cx="20" cy="20" r="17" fill="none" stroke-width="3.5" class="stroke-white/10" />
      <circle
        cx="20"
        cy="20"
        r="17"
        fill="none"
        stroke-width="3.5"
        stroke-linecap="round"
        [class]="reveal() ? revealArc : ''"
        [style.stroke]="color()"
        [attr.stroke-dasharray]="dash()"
      />
    </svg>
    <b
      class="font-display text-text relative leading-none font-extrabold"
      [class]="size() === 'lg' ? 'text-lg' : 'text-sm'"
      >{{ label() }}</b
    >
  `,
  host: {
    class: 'bg-background/78 relative grid shrink-0 place-items-center rounded-full',
    '[class.size-9]': "size() === 'md'",
    '[class.size-16]': "size() === 'lg'",
    role: 'img',
    '[attr.aria-label]': 'label() + "/5"',
  },
})
export class RatingRingComponent {
  rating = input.required<number>();
  size = input<'md' | 'lg'>('md');
  reveal = input(false);

  protected readonly revealArc =
    'transition-[stroke-dasharray] duration-slow motion-safe:animate-[ring-in_1100ms_var(--ease-smooth)_var(--ring-delay,0ms)_backwards] motion-reduce:transition-none';

  protected readonly dash = computed(() => {
    const value = Math.max(0, Math.min(10, this.rating()));
    return `${(value / 10) * CIRCUMFERENCE} ${CIRCUMFERENCE}`;
  });
  protected readonly color = computed(() => ratingToTextColor(this.rating(), 100));
  protected readonly label = computed(() => formatRating(this.rating()));
}
