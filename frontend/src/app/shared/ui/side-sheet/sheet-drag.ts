import { computed, signal } from '@angular/core';

const SLOP_PX = 6;
const DISMISS_RATIO = 0.25;
const FLICK_PX_PER_MS = 0.5;
const FLICK_MIN_PX = 24;

export const SHEET_RECIPES = {
  scrim: 'bg-overlay-scrim fixed inset-0 z-80 backdrop-blur-sm',
  overlay:
    'pointer-events-none fixed inset-0 z-85 flex items-end justify-center sm:items-center sm:p-4',
  panel:
    'bg-surface-raised shadow-overlay pointer-events-auto relative flex w-full flex-col overflow-hidden rounded-t-sheet max-sm:h-[calc(100dvh-env(safe-area-inset-top)-2rem)] sm:max-h-[90dvh] sm:rounded-sheet',
  handle: 'absolute inset-x-16 top-0 z-30 flex h-10 touch-none justify-center pt-2 sm:hidden',
  handleBar: 'bg-text/40 h-1 w-9 rounded-full',
  header: 'bg-surface-raised flex shrink-0 items-center gap-3 px-6 pt-8 pb-3 sm:pt-6',
  title:
    'font-display text-text min-w-0 flex-1 truncate text-[1.75rem] leading-none font-extrabold tracking-[-0.045em]',
  body: 'min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:auto]!',
  footer:
    'bg-surface-raised relative flex shrink-0 items-center gap-2 px-6 pt-3.5 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-6',
  block: 'bg-fill-subtle rounded-2xl p-4 sm:p-5',
  gutter: 'px-6',
  sectionHint: 'text-text-subtle mt-1.5 text-sm',
} as const;

export class SheetDrag {
  readonly offset = signal(0);
  readonly dragging = signal(false);
  readonly translate = computed(() => (this.offset() ? `0 ${this.offset()}px` : null));

  private origin: number | null = null;
  private lastY = 0;
  private lastTime = 0;
  private velocity = 0;

  constructor(
    private readonly height: () => number,
    private readonly release: (dismiss: boolean) => void,
  ) {}

  start(event: PointerEvent): void {
    if (event.button !== 0 || !matchMedia('(width < 640px)').matches) return;
    this.origin = event.clientY;
    this.lastY = event.clientY;
    this.lastTime = event.timeStamp;
    this.velocity = 0;
  }

  move(event: PointerEvent): void {
    if (this.origin === null) return;
    const delta = event.clientY - this.origin;
    if (!this.dragging()) {
      if (delta < -SLOP_PX) this.origin = null;
      if (delta < SLOP_PX) return;
      this.dragging.set(true);
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }
    const elapsed = event.timeStamp - this.lastTime;
    if (elapsed > 0) this.velocity = (event.clientY - this.lastY) / elapsed;
    this.lastY = event.clientY;
    this.lastTime = event.timeStamp;
    this.offset.set(Math.max(0, delta - SLOP_PX));
  }

  end(): void {
    this.origin = null;
    if (!this.dragging()) return;
    this.dragging.set(false);
    const offset = this.offset();
    const dismiss =
      offset > this.height() * DISMISS_RATIO ||
      (this.velocity > FLICK_PX_PER_MS && offset > FLICK_MIN_PX);
    if (!dismiss) this.offset.set(0);
    this.release(dismiss);
  }

  reset(): void {
    this.offset.set(0);
  }
}
