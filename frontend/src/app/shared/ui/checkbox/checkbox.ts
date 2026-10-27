import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IconComponent } from '@shared/ui/icon/icon';

let nextId = 0;

@Component({
  selector: 'shelfy-checkbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxComponent),
      multi: true,
    },
  ],
  templateUrl: './checkbox.html',
})
export class CheckboxComponent implements ControlValueAccessor {
  checked = input(false);
  checkedChange = output<boolean>();

  readonly inputId = input(`shelfy-checkbox-${nextId++}`);
  readonly isDisabled = signal(false);
  readonly formValue = signal<boolean | null>(null);
  private readonly boundToForm = signal(false);

  private onChange: (v: boolean) => void = () => {};
  private onTouched: () => void = () => {};

  get isChecked(): boolean {
    return this.boundToForm() ? (this.formValue() ?? false) : this.checked();
  }

  onToggle(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = target.checked;
    if (this.boundToForm()) {
      this.formValue.set(value);
    } else {
      target.checked = this.checked();
    }
    this.checkedChange.emit(value);
    this.onChange(value);
    this.onTouched();
  }

  writeValue(value: boolean | null): void {
    this.formValue.set(value ?? false);
  }

  registerOnChange(fn: (v: boolean) => void): void {
    this.boundToForm.set(true);
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }
}
