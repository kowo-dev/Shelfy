import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import { formatRating, ratingToTextColor } from '@shared/utils/collection-rating.util';

const MAX_STEP = 10;
const TAP_SLOP_PX = 4;
const KEY_STEP: Record<string, number> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
};

@Component({
  selector: 'shelfy-rating-slider',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    @let rating = value();
    <div
      #track
      role="slider"
      tabindex="0"
      class="focus-visible:outline-text flex w-fit cursor-pointer touch-none items-center gap-1 rounded-lg outline-offset-4 select-none focus-visible:outline-2"
      [style.--c]="color()"
      [attr.aria-label]="label()"
      aria-valuemin="1"
      [attr.aria-valuemax]="maxStep"
      [attr.aria-valuenow]="rating"
      [attr.aria-valuetext]="
        rating === null
          ? ('collection.verdict.none' | translate)
          : ('collection.sheet.rating_step'
            | translate: { count: rating / 2, value: format(rating) })
      "
      (pointerdown)="onDown($event)"
      (pointermove)="onMove($event)"
      (pointerup)="onUp()"
      (pointercancel)="onCancel()"
      (pointerleave)="onLeave()"
      (keydown)="onKeydown($event)"
    >
      @for (star of stars; track star) {
        <span
          class="duration-base ease-smooth relative block shrink-0 transition-transform motion-reduce:transition-none"
          [class]="sizeClass()"
          [class.scale-110]="scrubbing() && activeStar() === star"
        >
          <shelfy-icon
            name="star"
            [active]="true"
            class="text-fill-strong absolute inset-0 size-full"
          />
          <shelfy-icon
            name="star"
            [active]="true"
            class="ease-smooth absolute inset-0 size-full text-(--c) transition-[clip-path,color] duration-200 motion-reduce:transition-none"
            [style.clip-path]="'inset(0 ' + (100 - starFill(star)) + '% 0 0)'"
          />
        </span>
      }
    </div>
  `,
})
export class RatingSliderComponent {
  readonly value = input<number | null>(null);
  readonly size = input<'md' | 'lg' | 'xl'>('lg');
  readonly tone = input<'rating' | 'white'>('rating');
  readonly label = input<string | null>(null);

  readonly changed = output<number | null>();
  readonly previewed = output<number | null>();

  protected readonly maxStep = MAX_STEP;
  protected readonly stars = [1, 2, 3, 4, 5];
  protected readonly format = formatRating;
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');

  readonly preview = signal<number | null>(null);
  readonly scrubbing = signal(false);
  readonly shown = computed(() => this.preview() ?? this.value());
  readonly color = computed(() => {
    const rating = this.shown();
    if (rating === null) return 'var(--color-text-subtle)';
    return this.tone() === 'white' ? 'var(--color-text)' : ratingToTextColor(rating, 100);
  });
  readonly sizeClass = computed(
    () => ({ md: 'size-10', lg: 'size-10 sm:size-14', xl: 'size-11 sm:size-12' })[this.size()],
  );
  readonly activeStar = computed(() => Math.ceil((this.shown() ?? 0) / 2));

  private start: { x: number; moved: boolean } | null = null;

  stepAt(clientX: number, rect: Pick<DOMRect, 'left' | 'width'>): number {
    const fraction = (clientX - rect.left) / rect.width;
    return Math.min(MAX_STEP, Math.max(1, Math.ceil(fraction * MAX_STEP)));
  }

  starFill(star: number): number {
    const rating = this.shown() ?? 0;
    if (rating >= star * 2) return 100;
    return rating === star * 2 - 1 ? 50 : 0;
  }

  private setPreview(step: number | null): void {
    this.preview.set(step);
    this.previewed.emit(step);
  }

  onDown(event: PointerEvent): void {
    const track = this.track().nativeElement;
    track.setPointerCapture?.(event.pointerId);
    this.start = { x: event.clientX, moved: false };
    this.scrubbing.set(true);
    this.setPreview(this.stepAt(event.clientX, track.getBoundingClientRect()));
  }

  onMove(event: PointerEvent): void {
    if (!this.start && event.pointerType !== 'mouse') return;
    if (this.start && Math.abs(event.clientX - this.start.x) > TAP_SLOP_PX) this.start.moved = true;
    this.setPreview(this.stepAt(event.clientX, this.track().nativeElement.getBoundingClientRect()));
  }

  onUp(): void {
    if (!this.start) return;
    const step = this.preview();
    const tappedSame = !this.start.moved && step === this.value();
    this.start = null;
    this.scrubbing.set(false);
    this.setPreview(null);
    this.changed.emit(tappedSame ? null : step);
  }

  onCancel(): void {
    this.start = null;
    this.scrubbing.set(false);
    this.setPreview(null);
  }

  onLeave(): void {
    if (!this.start) this.setPreview(null);
  }

  onKeydown(event: KeyboardEvent): void {
    const next = this.keyTarget(event.key);
    if (next === undefined) return;
    event.preventDefault();
    if (next !== this.value()) this.changed.emit(next);
  }

  keyTarget(key: string): number | null | undefined {
    if (key === 'Home') return 1;
    if (key === 'End') return MAX_STEP;
    if (key === 'Backspace' || key === 'Delete') return null;
    const delta = KEY_STEP[key];
    if (!delta) return undefined;
    return Math.min(MAX_STEP, Math.max(1, (this.value() ?? 0) + delta));
  }
}
