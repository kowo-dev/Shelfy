import type { AbstractControl, ValidationErrors } from '@angular/forms';

export function passwordMatchValidator(
  passwordField: string,
  confirmField: string,
): (group: AbstractControl) => ValidationErrors | null {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get(passwordField)?.value as string;
    const confirm = group.get(confirmField)?.value as string;
    return password && confirm && password !== confirm ? { passwordsMismatch: true } : null;
  };
}
