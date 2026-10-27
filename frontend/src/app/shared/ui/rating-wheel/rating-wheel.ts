import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon';
import { formatRating, ratingToTextColor } from '@shared/utils/collection-rating.util';

const STEPS = Array.from({ length: 11 }, (_, step) => step);
const SETTLE_MS = 140;
const KEY_STEP: Record<string, number> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
};

@Component({
  selector: 'shelfy-rating-wheel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { class: 'block' },
  template: `
    <div
      #track
      role="slider"
      tabindex="0"
      aria-valuemin="0"
      [attr.aria-valuemax]="steps.length - 1"
      [attr.aria-valuenow]="current()"
      [attr.aria-valuetext]="current() ? text(current()) : '–'"
      [attr.aria-label]="label()"
      class="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overflow-y-hidden overscroll-x-contain [mask-image:linear-gradient(90deg,transparent,#000_28%,#000_72%,transparent)] px-[calc(50%-3.25rem)] outline-none focus-visible:outline-2 focus-visible:outline-offset-4 [&::-webkit-scrollbar]:hidden"
      (scroll)="onScroll()"
      (keydown)="onKeydown($event)"
    >
      @for (step of steps; track step) {
        @let on = step === current();
        <button
          type="button"
          tabindex="-1"
          class="font-display ease-expo grid h-28 w-[6.5rem] shrink-0 snap-center place-items-center text-[2.5rem] font-extrabold tracking-[-0.04em] transition-[transform,color] duration-350 motion-reduce:transition-none"
          [class]="on ? 'scale-[1.45]' : 'text-white/30'"
          [style.color]="on && step ? color(step) : null"
          (click)="go(step, true)"
        >
          <span class="relative inline-block tabular-nums"
            >{{ step ? text(step) : '–' }}
            @if (on) {
              <shelfy-icon
                name="star"
                [active]="true"
                class="absolute top-1/2 left-full ml-[0.1em] size-[0.85em] -translate-y-[62%]"
              />
            }
          </span>
        </button>
      }
    </div>
  `,
})
export class RatingWheelComponent {
  readonly value = input<number | null>(null);
  readonly label = input('');
  readonly changed = output<number | null>();

  protected readonly steps = STEPS;
  readonly current = signal(0);
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  private settle: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const value = this.value() ?? 0;
      untracked(() => {
        if (this.current() === value) return;
        this.current.set(value);
        this.scrollTo(value, false);
      });
    });
    afterNextRender(() => this.scrollTo(this.current(), false));
    inject(DestroyRef).onDestroy(() => {
      if (this.settle) clearTimeout(this.settle);
    });
  }

  text(step: number): string {
    return formatRating(step);
  }

  color(step: number): string {
    return ratingToTextColor(step, 100);
  }

  go(step: number, smooth: boolean): void {
    this.scrollTo(Math.max(0, Math.min(STEPS.length - 1, step)), smooth);
  }

  onScroll(): void {
    const el = this.track().nativeElement;
    const width = el.firstElementChild?.clientWidth ?? 0;
    if (!width) return;
    const step = Math.max(0, Math.min(STEPS.length - 1, Math.round(el.scrollLeft / width)));
    this.current.set(step);
    if (this.settle) clearTimeout(this.settle);
    this.settle = setTimeout(() => {
      if (step !== (this.value() ?? 0)) this.changed.emit(step || null);
    }, SETTLE_MS);
  }

  onKeydown(event: KeyboardEvent): void {
    const delta = KEY_STEP[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    this.go(this.current() + delta, true);
  }

  private scrollTo(step: number, smooth: boolean): void {
    const el = this.track().nativeElement;
    const width = el.firstElementChild?.clientWidth ?? 0;
    el.scrollTo?.({ left: step * width, behavior: smooth ? 'smooth' : 'instant' });
  }
}
