import { trapTab } from '@shared/ui/focus-trap/focus-trap';
import { TranslatePipe } from '@app/shared/pipes/translate';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  ElementRef,
  DestroyRef,
  inject,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'shelfy-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscape($event)',
  },
  imports: [TranslatePipe],
  template: `
    @if (open() || closing()) {
      <div
        #overlay
        popover="manual"
        class="fixed inset-0 z-100 m-0 flex size-full max-h-none max-w-none items-end justify-center overflow-visible border-0 bg-transparent p-0 text-inherit"
        [class]="overlayClass()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title() || label() || null"
      >
        <button
          type="button"
          class="bg-overlay-scrim absolute inset-0 cursor-default backdrop-blur-sm"
          [class.animate-overlay-in]="!closing()"
          [class.animate-overlay-out]="closing()"
          [attr.aria-label]="'dialog.close' | translate"
          tabindex="-1"
          (click)="requestClose()"
        ></button>

        <div
          #panel
          tabindex="-1"
          class="outline-none"
          [class]="panelClass()"
          [class.max-sm:animate-sheet-in]="!closing()"
          [class.sm:animate-pop-in]="!closing()"
          [class.max-sm:animate-sheet-out]="closing()"
          [class.sm:animate-pop-out]="closing()"
          (animationend)="onPanelAnimationEnd($event)"
          (keydown)="onPanelKeydown($event)"
          [style.view-transition-name]="viewTransitionName()"
        >
          @if (layout() !== 'sheet') {
            <ng-content select="[dialogPanel]" />
          } @else {
            @if (!hideHeader()) {
              <h2
                class="font-display text-text line-clamp-3 shrink-0 text-[1.875rem] leading-none font-extrabold tracking-[-0.05em] text-balance"
              >
                {{ title() }}
              </h2>
            }

            <div
              class="mt-4.5 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain text-base leading-[1.6]"
            >
              <ng-content />
            </div>

            <div class="mt-6 grid shrink-0 auto-cols-fr grid-flow-col gap-2 empty:hidden">
              <ng-content select="[dialogFooter]" />
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class DialogComponent {
  open = input(false);
  title = input('');
  label = input('');
  viewTransitionName = input<string | null>(null);
  hideHeader = input(false);
  size = input<'sm' | 'md' | 'lg'>('md');
  layout = input<'sheet' | 'panel' | 'wide' | 'palette'>('sheet');
  dismissible = input(true);
  closed = output<void>();

  readonly closing = signal(false);

  readonly overlayClass = computed(() => {
    if (this.layout() === 'palette') return 'sm:items-start sm:px-6 sm:pt-[12dvh]';
    if (this.layout() === 'panel') return 'sm:items-center sm:p-6';
    return 'sm:items-center sm:p-4';
  });

  readonly panelClass = computed(() => {
    const base =
      'relative flex w-full flex-col overflow-hidden shadow-[0_40px_100px_-30px_#000] transition-[max-width,border-radius] duration-base max-sm:rounded-t-[1.75rem] sm:rounded-[1.75rem]';
    if (this.layout() === 'panel') {
      return `${base} bg-surface h-dvh sm:h-[min(86dvh,880px)] sm:max-w-[min(74rem,calc(100vw-3rem))]`;
    }
    if (this.layout() === 'wide') {
      return `${base} bg-surface h-dvh sm:h-[min(94dvh,1080px)] sm:max-w-[min(100rem,calc(100vw-2rem))]`;
    }
    if (this.layout() === 'palette') {
      return `${base} bg-surface h-dvh sm:h-auto sm:max-h-[min(80dvh,820px)] sm:max-w-[min(56rem,calc(100vw-3rem))]`;
    }
    const card = `${base} bg-surface-raised max-h-[90vh] p-7 max-sm:pb-[max(1.75rem,env(safe-area-inset-bottom))] sm:max-h-[85vh]`;
    const width = { sm: 'sm:max-w-120', md: 'sm:max-w-120', lg: 'sm:max-w-6xl' }[this.size()];
    return `${card} ${width}`;
  });

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly overlay = viewChild<ElementRef<HTMLElement>>('overlay');
  private previouslyFocused: HTMLElement | null = null;
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterRenderEffect(() => {
      const el = this.overlay()?.nativeElement;
      if (el && typeof el.showPopover === 'function' && !el.matches(':popover-open')) {
        el.showPopover();
      }
    });
    this.destroyRef.onDestroy(() => this.previouslyFocused?.focus?.());
    effect(() => {
      if (this.open()) {
        this.closing.set(false);
        this.previouslyFocused = document.activeElement as HTMLElement | null;
        setTimeout(() => {
          const panel = this.panel()?.nativeElement;
          if (panel && !panel.contains(document.activeElement)) panel.focus();
        }, 0);
      } else {
        this.previouslyFocused?.focus?.();
        this.previouslyFocused = null;
      }
    });
  }

  onPanelKeydown(event: KeyboardEvent): void {
    const panel = this.panel()?.nativeElement;
    if (panel) trapTab(event, panel);
  }

  requestClose(): void {
    if (!this.open() || !this.dismissible()) {
      return;
    }
    this.closing.set(true);
  }

  onPanelAnimationEnd(event: AnimationEvent): void {
    if (event.target !== event.currentTarget || !this.closing()) {
      return;
    }
    this.closing.set(false);
    this.closed.emit();
  }

  onEscape(event: Event): void {
    if (event.defaultPrevented) return;
    this.requestClose();
  }
}
