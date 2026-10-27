import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const encoder = new TextEncoder();

export function maxBytesValidator(max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string | null;
    if (!value) return null;
    const bytes = encoder.encode(value).length;
    return bytes > max ? { maxbytes: { max, actual: bytes } } : null;
  };
}
