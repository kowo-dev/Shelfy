import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { buttonClasses } from '@shared/ui/button/button';
import { IconComponent } from '@shared/ui/icon/icon';
import { trapTab } from '@shared/ui/focus-trap/focus-trap';

@Component({
  selector: 'shelfy-filter-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IconComponent],
  template: `
    @if (open()) {
      <div
        class="bg-overlay-scrim fixed inset-0 z-80 backdrop-blur-[6px]"
        animate.enter="animate-fade-in"
        animate.leave="animate-fade-out"
        aria-hidden="true"
        (click)="closed.emit()"
      ></div>
      <section
        #panel
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        [attr.aria-label]="title()"
        class="bg-surface-raised shadow-overlay max-md:rounded-t-sheet md:rounded-sheet fixed z-86 flex flex-col overflow-hidden outline-none max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[90dvh] md:top-3 md:right-3 md:bottom-3 md:w-[min(30rem,calc(100vw-1.5rem))]"
        animate.enter="max-md:animate-sheet-in md:animate-drawer-in"
        animate.leave="max-md:animate-sheet-out md:animate-drawer-out"
        (keydown)="onKeydown($event)"
      >
        <header class="flex items-center justify-between gap-3 px-5 pt-5 pb-2 md:px-6.5 md:pt-6">
          <h2
            class="font-display text-text text-[1.75rem] leading-none font-extrabold tracking-[-0.045em] md:text-[2.125rem]"
          >
            {{ title() }}
          </h2>
          <button
            type="button"
            class="bg-fill-strong text-text-muted hover:text-text grid size-11 shrink-0 cursor-pointer place-items-center rounded-full transition-colors"
            [attr.aria-label]="'dialog.close' | translate"
            (click)="closed.emit()"
          >
            <shelfy-icon name="close" size="18" />
          </button>
        </header>
        <div
          class="flex min-h-0 flex-1 [scrollbar-width:none] flex-col gap-7 overflow-y-auto overscroll-contain px-5 pt-4 pb-6 md:px-6.5"
        >
          <ng-content />
        </div>
        @if (showLabel(); as label) {
          <footer
            class="grid grid-cols-2 gap-2 px-5 pt-3.5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:px-6.5 md:pb-6"
          >
            <button type="button" [class]="secondary" (click)="cleared.emit()">
              {{ 'library.clear_all' | translate }}
            </button>
            <button type="button" [class]="primary" (click)="closed.emit()">
              {{ label }}
            </button>
          </footer>
        }
      </section>
    }
  `,
})
export class FilterPanelComponent {
  private readonly injector = inject(Injector);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  readonly open = input(false);
  readonly title = input.required<string>();
  readonly showLabel = input<string | null>(null);

  readonly closed = output<void>();
  readonly cleared = output<void>();

  protected readonly primary = buttonClasses({
    variant: 'primary',
    extraClass: 'h-13.5 min-w-0 rounded-[1.125rem] px-3.5',
  });
  protected readonly secondary = buttonClasses({
    variant: 'secondary',
    extraClass: 'h-13.5 min-w-0 rounded-[1.125rem] px-3.5',
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      afterNextRender(() => this.panel()?.nativeElement.focus(), { injector: this.injector });
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closed.emit();
      return;
    }
    const panel = this.panel()?.nativeElement;
    if (panel) trapTab(event, panel);
  }
}
