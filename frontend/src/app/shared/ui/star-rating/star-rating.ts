import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import { formatRating, ratingToTextColor } from '@shared/utils/collection-rating.util';

const MAX_STEP = 10;
const KEY_STEP: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

export type StarRatingSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'shelfy-star-rating',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IconComponent],
  host: { class: 'block' },
  template: `
    <div
      class="flex"
      [class]="size() === 'sm' ? 'gap-0.5' : size() === 'md' ? 'gap-1' : 'gap-1.5'"
      role="radiogroup"
      [attr.aria-label]="label()"
      [style.--c]="color()"
      (mouseleave)="preview(null)"
    >
      @for (star of stars; track star) {
        @let fill = starFill(star);
        <span
          class="duration-base has-focus-visible:outline-text relative block transition-transform has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-active:scale-90 motion-reduce:transition-none"
          [class]="
            (size() === 'sm'
              ? 'size-5 rounded-xs '
              : size() === 'md'
                ? 'size-8 rounded-sm '
                : 'size-11 rounded-md ') +
            (justPicked() === star * 2 - 1 || justPicked() === star * 2
              ? 'motion-safe:animate-pulse-confirm'
              : '')
          "
        >
          <shelfy-icon
            name="star"
            [active]="true"
            class="text-fill-strong absolute inset-0"
            [class]="iconSize()"
          />
          <span
            class="duration-fast ease-smooth absolute inset-y-0 left-0 overflow-hidden transition-[width] motion-reduce:transition-none"
            [style.width.%]="fill"
          >
            <shelfy-icon name="star" [active]="true" class="text-(--c)" [class]="iconSize()" />
          </span>
          @for (step of [star * 2 - 1, star * 2]; track step) {
            <button
              #half
              type="button"
              role="radio"
              class="absolute inset-y-0 w-1/2 cursor-pointer outline-hidden"
              [class]="step % 2 === 1 ? 'left-0' : 'right-0'"
              [attr.aria-checked]="value() === step"
              [attr.aria-label]="
                'collection.sheet.rating_step'
                  | translate: { count: step / 2, value: formatRating(step) }
              "
              [attr.tabindex]="step === (value() ?? 1) ? 0 : -1"
              (keydown)="onKeydown($event, step)"
              (mouseenter)="preview(step)"
              (focus)="preview(step)"
              (blur)="preview(null)"
              (click)="pick(step)"
            ></button>
          }
        </span>
      }
    </div>
  `,
})
export class StarRatingComponent {
  readonly value = input<number | null>(null);
  readonly size = input<StarRatingSize>('lg');
  readonly toggle = input(false);
  readonly label = input<string | null>(null);

  readonly changed = output<number | null>();
  readonly previewed = output<number | null>();

  readonly previewRating = signal<number | null>(null);
  readonly shownRating = computed(() => this.previewRating() ?? this.value());
  readonly color = computed(() => {
    const rating = this.shownRating();
    return rating === null ? 'var(--color-text-subtle)' : ratingToTextColor(rating, 100);
  });
  readonly iconSize = computed(() =>
    this.size() === 'sm' ? 'size-5' : this.size() === 'md' ? 'size-8' : 'size-11',
  );
  readonly justPicked = signal<number | null>(null);
  private pickedTimer: ReturnType<typeof setTimeout> | null = null;
  readonly stars = [1, 2, 3, 4, 5];
  protected readonly formatRating = formatRating;
  private readonly halves = viewChildren<ElementRef<HTMLButtonElement>>('half');

  starFill(star: number): number {
    const rating = this.shownRating() ?? 0;
    if (rating >= star * 2) return 100;
    return rating === star * 2 - 1 ? 50 : 0;
  }

  preview(step: number | null): void {
    this.previewRating.set(step);
    this.previewed.emit(step);
  }

  pick(step: number): void {
    this.preview(null);
    this.justPicked.set(step);
    if (this.pickedTimer) clearTimeout(this.pickedTimer);
    this.pickedTimer = setTimeout(() => this.justPicked.set(null), 300);
    this.changed.emit(this.toggle() && this.value() === step ? null : step);
  }

  targetStep(from: number, key: string): number | null {
    if (key === 'Home') return 1;
    if (key === 'End') return MAX_STEP;
    const delta = KEY_STEP[key];
    return delta ? ((from - 1 + delta + MAX_STEP) % MAX_STEP) + 1 : null;
  }

  onKeydown(event: KeyboardEvent, from: number): void {
    const target = this.targetStep(from, event.key);
    if (target === null) return;
    event.preventDefault();
    this.halves()[target - 1]?.nativeElement.focus();
  }
}
