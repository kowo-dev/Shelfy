import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  forwardRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { IconComponent } from '@shared/ui/icon/icon';
import { HIT_AREA_40, SEARCH_FIELD, SEARCH_FIELD_LARGE } from '@shared/ui/ui-recipes';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { TextControl } from '@shared/ui/text-control';

let nextId = 0;

@Component({
  selector: 'shelfy-searchbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TranslatePipe],
  host: { class: 'block min-w-0' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchbarComponent),
      multi: true,
    },
  ],
  template: `
    <div [class]="containerClasses()">
      <span class="text-text-subtle flex shrink-0 items-center leading-none">
        <shelfy-icon name="search" size="lg" />
      </span>

      <input
        #inputEl
        [id]="id"
        type="text"
        [value]="value()"
        [disabled]="isDisabled()"
        [placeholder]="placeholder()"
        [attr.aria-label]="placeholder() || null"
        [class]="inputClasses()"
        (input)="handleInput($event)"
        (blur)="handleBlur()"
        (focus)="focused.emit()"
      />

      @if (value()) {
        <button
          type="button"
          class="text-text-subtle hover:text-text flex shrink-0 cursor-pointer items-center justify-center rounded-full p-1 transition-[color,background-color,opacity] active:opacity-70"
          [class]="hitArea"
          [attr.aria-label]="clearLabel() || ('shared.clear' | translate)"
          (click)="clear()"
        >
          <shelfy-icon name="close" size="sm" />
        </button>
      }
    </div>
  `,
})
export class SearchbarComponent extends TextControl {
  placeholder = input<string>('');
  clearLabel = input<string>('');
  readonly hitArea = HIT_AREA_40;
  autofocus = input(false);
  variant = input<'default' | 'overlay' | 'toolbar' | 'pill' | 'large'>('default');

  readonly focused = output<void>();
  readonly cleared = output<void>();

  readonly id = `shelfy-searchbar-${nextId++}`;

  containerClasses = computed(() =>
    this.variant() === 'overlay'
      ? 'group/searchbar flex w-full items-center gap-4 overflow-hidden pb-6 text-text-subtle'
      : this.variant() === 'large'
        ? `group/searchbar flex w-full items-center gap-3 overflow-hidden px-4.5 text-text-subtle focus-within:text-text ${SEARCH_FIELD_LARGE}`
        : `group/searchbar flex h-13 w-full items-center gap-2.5 overflow-hidden px-4 text-text-subtle focus-within:text-text ${SEARCH_FIELD}`,
  );

  inputClasses = computed(() =>
    this.variant() === 'large'
      ? 'text-text placeholder:text-text-subtle min-w-0 flex-1 bg-transparent py-3 text-base font-medium caret-(--color-accent) focus:outline-none'
      : this.variant() === 'overlay'
        ? 'text-text placeholder:text-white/22 min-w-0 flex-1 bg-transparent font-display text-display font-extrabold focus:outline-none'
        : 'text-text placeholder:text-text-subtle min-w-0 flex-1 bg-transparent py-2.5 text-base caret-(--color-accent) focus:outline-none',
  );

  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('inputEl');

  constructor() {
    super();
    afterNextRender(() => {
      if (this.autofocus()) this.inputRef().nativeElement.focus();
    });
  }

  clear(): void {
    this.value.set('');
    this.onChange('');
    this.cleared.emit();
  }

  focus(): void {
    this.inputRef().nativeElement.focus();
  }
}
