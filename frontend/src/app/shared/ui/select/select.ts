import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { IconComponent } from '@shared/ui/icon/icon';
import type { IconName } from '@shared/ui/icon/icon-registry';
import { CHEVRON, CHIP, CHIP_OFF, CHIP_ON, MENU_ITEM, MENU_PANEL } from '@shared/ui/ui-recipes';
import { TextControl } from '@shared/ui/text-control';

export interface SelectOption {
  value: string;
  label: string;
  icon?: IconName;
}

export type SelectVariant = 'default' | 'toolbar';

let nextId = 0;

@Component({
  selector: 'shelfy-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, NgTemplateOutlet],
  host: {
    class: 'block',
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'onEscape()',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
  templateUrl: './select.html',
})
export class SelectComponent extends TextControl {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  label = input<string>('');
  error = input<string>('');
  hint = input<string>('');
  variant = input<SelectVariant>('default');
  prefix = input('');
  options = input.required<SelectOption[]>();

  readonly open = signal(false);
  readonly id = `shelfy-select-${nextId++}`;

  selectedOption = computed(() => this.options().find((o) => o.value === this.value()) ?? null);
  selectedLabel = computed(() => this.selectedOption()?.label ?? '');

  readonly chevron = CHEVRON;
  readonly menuItem = computed(() => MENU_ITEM);

  panelClasses = computed(
    () =>
      `${MENU_PANEL} ${this.variant() === 'toolbar' ? 'right-0 origin-top-right max-md:right-auto max-md:left-0 max-md:origin-top-left' : 'left-0 min-w-full origin-top-left'}`,
  );

  triggerClasses = computed(() => {
    if (this.variant() === 'toolbar') {
      return `${CHIP} ${this.open() ? CHIP_ON : CHIP_OFF} w-full text-left`;
    }

    const error = this.error() ? 'form-control--error' : '';
    return `form-control form-control--md flex w-full cursor-pointer items-center pr-9 text-left ${error}`.trim();
  });

  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  onEscape(): void {
    this.close();
  }

  toggleOpen(): void {
    if (this.isDisabled()) {
      return;
    }
    this.open.update((v) => !v);
  }

  close(): void {
    if (this.open()) {
      this.open.set(false);
      this.onTouched();
    }
  }

  selectValue(value: string): void {
    this.value.set(value);
    this.onChange(value);
    this.close();
  }

  isSelected(value: string): boolean {
    return this.value() === value;
  }
}
