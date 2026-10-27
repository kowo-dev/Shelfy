import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { buttonClasses } from '@shared/ui/button/button';
import { IconComponent } from '@shared/ui/icon/icon';
import { MENU_ITEM, MENU_PANEL } from '@shared/ui/ui-recipes';

export interface MenuButtonItem {
  id: string;
  label: string;
  icon?: string;
  meta?: string | number | null;
}

@Component({
  selector: 'shelfy-menu-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: {
    class: 'relative block shrink-0',
    '(document:pointerdown)': 'onDocumentPointer($event)',
  },
  template: `
    <button
      #trigger
      type="button"
      [class]="triggerClasses()"
      aria-haspopup="menu"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="label()"
      [attr.title]="text() ? null : label()"
      (click)="toggle()"
      (keydown.arrowdown)="openFromKey($event)"
      (keydown.escape)="close(true)"
    >
      <shelfy-icon [name]="icon()" size="sm" />
      @if (text(); as value) {
        {{ value }}
      }
    </button>
    @if (open()) {
      <div
        role="menu"
        tabindex="-1"
        [attr.aria-label]="label()"
        [class]="panel + ' ' + panelClass()"
        animate.leave="animate-pop-out"
        (keydown)="onMenuKey($event)"
      >
        @for (item of items(); track item.id) {
          @let checked = multi() ? selectedIds()!.includes(item.id) : item.id === selectedId();
          <button
            #entry
            type="button"
            [attr.role]="multi() ? 'menuitemcheckbox' : radio() ? 'menuitemradio' : 'menuitem'"
            [attr.aria-checked]="multi() || radio() ? checked : null"
            [attr.tabindex]="-1"
            [class]="menuItem"
            (click)="pick(item.id)"
          >
            @if (item.icon) {
              <shelfy-icon [name]="item.icon" size="md" />
            }
            <span class="flex-1">{{ item.label }}</span>
            @if (item.meta !== null && item.meta !== undefined) {
              <span class="text-text-subtle text-sm tabular-nums">{{ item.meta }}</span>
            }
            @if (checked) {
              <shelfy-icon name="check" size="md" />
            }
          </button>
        }
      </div>
    }
  `,
})
export class MenuButtonComponent {
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly entries = viewChildren<ElementRef<HTMLButtonElement>>('entry');

  readonly label = input.required<string>();
  readonly icon = input.required<string>();
  readonly items = input.required<MenuButtonItem[]>();
  readonly text = input<string | null>(null);
  readonly variant = input<'primary' | 'tool'>('tool');
  readonly selectedId = input<string | null>(null);
  readonly selectedIds = input<string[] | null>(null);
  readonly panelClass = input('right-0 w-64 origin-top-right');
  readonly triggerClass = input<string | null>(null);
  readonly picked = output<string>();

  readonly menuItem = MENU_ITEM;
  readonly panel = MENU_PANEL;
  readonly open = signal(false);
  readonly radio = computed(() => this.selectedId() !== null);
  readonly multi = computed(() => this.selectedIds() !== null);

  readonly triggerClasses = computed(
    () =>
      this.triggerClass() ??
      (this.variant() === 'primary'
        ? buttonClasses({
            variant: 'primary',
            iconOnly: !this.text(),
            extraClass: 'shrink-0',
          })
        : buttonClasses({
            variant: 'secondary',
            iconOnly: true,
            extraClass: 'relative shrink-0',
          })),
  );

  toggle(): void {
    if (this.open()) this.close(false);
    else this.openMenu();
  }

  openFromKey(event: Event): void {
    event.preventDefault();
    this.openMenu();
  }

  close(restoreFocus: boolean): void {
    if (!this.open()) return;
    this.open.set(false);
    if (restoreFocus) this.trigger().nativeElement.focus();
  }

  pick(id: string): void {
    if (!this.multi()) this.close(true);
    this.picked.emit(id);
  }

  onMenuKey(event: KeyboardEvent): void {
    const buttons = this.entries().map((entry) => entry.nativeElement);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const move = (to: number) => {
      event.preventDefault();
      buttons[(to + buttons.length) % buttons.length]?.focus();
    };
    switch (event.key) {
      case 'ArrowDown':
        return move(index + 1);
      case 'ArrowUp':
        return move(index - 1);
      case 'Home':
        return move(0);
      case 'End':
        return move(buttons.length - 1);
      case 'Escape':
        event.preventDefault();
        return this.close(true);
      case 'Tab':
        return this.close(true);
    }
  }

  onDocumentPointer(event: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close(false);
  }

  private openMenu(): void {
    this.open.set(true);
    afterNextRender(
      () => {
        const buttons = this.entries().map((entry) => entry.nativeElement);
        const selected = this.items().findIndex((item) => item.id === this.selectedId());
        buttons[Math.max(0, selected)]?.focus();
      },
      { injector: this.injector },
    );
  }
}
