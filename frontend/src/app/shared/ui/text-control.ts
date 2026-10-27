import { signal } from '@angular/core';
import type { ControlValueAccessor } from '@angular/forms';

export abstract class TextControl implements ControlValueAccessor {
  readonly value = signal('');
  readonly isDisabled = signal(false);

  protected onChange: (v: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: string | number | null): void {
    this.value.set(value == null ? '' : String(value));
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  handleInput(event: Event): void {
    const v = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.value.set(v);
    this.onChange(v);
  }

  handleBlur(): void {
    this.onTouched();
  }
}
