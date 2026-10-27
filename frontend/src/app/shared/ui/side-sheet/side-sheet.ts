import { buttonClasses } from '@shared/ui/button/button';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import { SHEET_RECIPES, SheetDrag } from './sheet-drag';
import { FOCUSABLE, trapTab } from '@shared/ui/focus-trap/focus-trap';

const ELEVATED_SCRIM = 'z-110';
const ELEVATED_PANEL = 'z-115';

const ownsEscape = (event: Event): boolean =>
  (event.target as Element | null)?.closest?.('[data-owns-escape]') != null;

@Component({
  selector: 'shelfy-side-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TranslatePipe],
  template: `
    <div
      [class]="scrimClass() + (closing() ? ' animate-fade-out' : ' animate-fade-in')"
      aria-hidden="true"
      (click)="requestClose()"
    ></div>

    <div [class]="overlayClass()">
      <aside
        #panel
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        [class]="
          panelClass +
          (closing()
            ? ' max-sm:animate-sheet-out sm:animate-pop-out'
            : ' max-sm:animate-sheet-in sm:animate-pop-in') +
          widths[size()]
        "
        [style.translate]="drag.translate()"
        [style.transition]="drag.dragging() ? 'none' : dragSettle"
        (animationend)="onPanelAnimationEnd($event)"
      >
        <div
          [class]="recipes.handle"
          (pointerdown)="drag.start($event)"
          (pointermove)="drag.move($event)"
          (pointerup)="drag.end()"
          (pointercancel)="drag.end()"
        >
          <span [class]="recipes.handleBar" aria-hidden="true"></span>
        </div>

        <header
          [class]="recipes.header"
          (pointerdown)="drag.start($event)"
          (pointermove)="drag.move($event)"
          (pointerup)="drag.end()"
          (pointercancel)="drag.end()"
        >
          <ng-content select="[sheetLead]" />
          @if (cover(); as src) {
            <img [src]="src" alt="" class="h-10 w-7 shrink-0 rounded-xs object-cover" />
          }
          <div class="min-w-0 flex-1">
            @if (kicker(); as text) {
              <p class="text-text-subtle truncate text-sm">{{ text }}</p>
            }
            <h2 [class]="recipes.title">{{ title() }}</h2>
          </div>
          <button
            type="button"
            [class]="closeButton"
            [attr.aria-label]="'dialog.close' | translate"
            (click)="requestClose()"
          >
            <shelfy-icon name="close" size="md" />
          </button>
        </header>

        <div [class]="recipes.body">
          <div class="flex flex-col gap-3 px-6 pb-5">
            <ng-content />
          </div>
        </div>

        @if (footer()) {
          <footer [class]="recipes.footer + ' justify-end'">
            <ng-content select="[sheetFooter]" />
          </footer>
        }
      </aside>
    </div>
  `,
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class SideSheetComponent {
  title = input.required<string>();
  size = input<'md' | 'lg' | 'xl'>('lg');
  footer = input(false);
  cover = input<string | null>(null);
  kicker = input<string | null>(null);
  busy = input(false);
  dirty = input(false);
  elevated = input(false);

  readonly closed = output<void>();

  private readonly translate = inject(TranslateService);
  private readonly confirm = inject(ConfirmService);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly returnFocus = document.activeElement as HTMLElement | null;
  readonly closing = signal(false);
  protected readonly recipes = SHEET_RECIPES;
  protected readonly dragSettle = 'translate var(--duration-base) var(--ease-drawer)';
  protected readonly closeButton = buttonClasses({
    variant: 'secondary',
    iconOnly: true,
    extraClass: 'shrink-0',
  });
  protected readonly scrimClass = computed(() =>
    this.elevated() ? this.recipes.scrim.replace('z-80', ELEVATED_SCRIM) : this.recipes.scrim,
  );
  protected readonly overlayClass = computed(() =>
    this.elevated() ? this.recipes.overlay.replace('z-85', ELEVATED_PANEL) : this.recipes.overlay,
  );
  protected readonly panelClass = this.recipes.panel;
  protected readonly widths = { md: ' sm:max-w-md', lg: ' sm:max-w-xl', xl: ' sm:max-w-4xl' };
  protected readonly drag = new SheetDrag(
    () => this.panel()?.nativeElement.offsetHeight ?? 0,
    (dismiss) => void this.onDragRelease(dismiss),
  );

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      if (host.parentElement !== document.body) document.body.appendChild(host);
      this.panel()?.nativeElement.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    });
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !this.elevated() || ownsEscape(event)) return;
      event.stopPropagation();
      event.preventDefault();
      void this.requestClose();
    };
    document.addEventListener('keydown', onEscape, true);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('keydown', onEscape, true);
      host.remove();
    });
  }

  private async onDragRelease(dismiss: boolean): Promise<void> {
    if (!dismiss) return;
    await this.requestClose();
    if (!this.closing()) this.drag.reset();
  }

  async requestClose(): Promise<void> {
    if (this.closing() || this.busy()) return;
    if (this.dirty() && !(await this.confirm.ask(this.translate.get('edit.unsaved_changes'))))
      return;
    this.closing.set(true);
  }

  onPanelAnimationEnd(event: AnimationEvent): void {
    if (!this.closing() || event.target !== event.currentTarget) return;
    this.returnFocus?.focus?.();
    this.closed.emit();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (event.defaultPrevented) return;
      event.preventDefault();
      void this.requestClose();
      return;
    }
    const panel = this.panel()?.nativeElement;
    if (panel) trapTab(event, panel);
  }
}
