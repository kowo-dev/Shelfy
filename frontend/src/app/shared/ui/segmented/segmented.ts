import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';

export interface SegmentedOption {
  id: string;
  label: string;
  count?: number | null;
}

@Component({
  selector: 'shelfy-segmented',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex max-w-full' },
  template: `
    <div
      class="relative inline-flex max-w-full [scrollbar-width:none] items-stretch overflow-x-auto rounded-2xl bg-white/8 p-1"
      [class]="size() === 'sm' ? 'h-11' : 'h-13'"
      role="radiogroup"
      [attr.aria-label]="label()"
    >
      <span
        class="ease-expo pointer-events-none absolute top-1 bottom-1 rounded-xl bg-white/16 shadow-[0_6px_16px_-8px_rgb(0_0_0/0.8)] motion-reduce:transition-none"
        [class]="
          (animated() ? 'transition-[left,width] duration-500 ' : '') + (ink() ? '' : 'opacity-0')
        "
        [style.left.px]="ink()?.left ?? 0"
        [style.width.px]="ink()?.width ?? 0"
        aria-hidden="true"
      ></span>
      @for (option of options(); track option.id; let i = $index) {
        @let on = option.id === value();
        <button
          #segment
          type="button"
          role="radio"
          class="relative flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-4 font-semibold whitespace-nowrap transition-colors duration-300"
          [class]="
            (size() === 'sm' ? 'text-sm ' : 'text-[0.9375rem] ') +
            (on ? 'text-text' : 'text-text-muted hover:text-text')
          "
          [attr.aria-checked]="on"
          [attr.tabindex]="on ? 0 : -1"
          (click)="changed.emit(option.id)"
          (keydown)="onKeydown($event, i)"
        >
          {{ option.label }}
          @if (option.count !== undefined && option.count !== null) {
            <span class="tabular-nums opacity-60">{{ option.count }}</span>
          }
        </button>
      }
    </div>
  `,
})
export class SegmentedComponent {
  readonly options = input.required<SegmentedOption[]>();
  readonly value = input.required<string>();
  readonly label = input<string | null>(null);
  readonly size = input<'md' | 'sm'>('md');
  readonly changed = output<string>();

  private readonly segments = viewChildren<ElementRef<HTMLElement>>('segment');
  readonly ink = signal<{ left: number; width: number } | null>(null);
  readonly animated = signal(false);

  constructor() {
    afterRenderEffect(() => {
      const index = this.options().findIndex((option) => option.id === this.value());
      const el = this.segments()[index]?.nativeElement;
      this.ink.set(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
      if (el && !this.animated()) requestAnimationFrame(() => this.animated.set(true));
    });
  }

  onKeydown(event: KeyboardEvent, index: number): void {
    const last = this.options().length - 1;
    const target = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = target < 0 ? last : target > last ? 0 : target;
    this.changed.emit(this.options()[next].id);
    this.segments()[next]?.nativeElement.focus();
  }
}
