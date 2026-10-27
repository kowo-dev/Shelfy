import { FormControl, FormGroup } from '@angular/forms';
import { passwordMatchValidator } from './password-match-validator.util';

describe('passwordMatchValidator', () => {
  function buildGroup(password: string | null, confirm: string | null): FormGroup {
    return new FormGroup({
      password: new FormControl(password),
      confirm: new FormControl(confirm),
    });
  }

  it('returns null when both fields match', () => {
    const validator = passwordMatchValidator('password', 'confirm');
    const group = buildGroup('secret123', 'secret123');

    expect(validator(group)).toBeNull();
  });

  it('returns a mismatch error when the fields differ', () => {
    const validator = passwordMatchValidator('password', 'confirm');
    const group = buildGroup('secret123', 'other456');

    expect(validator(group)).toEqual({ passwordsMismatch: true });
  });

  it('returns null when either field is empty', () => {
    const validator = passwordMatchValidator('password', 'confirm');

    expect(validator(buildGroup('', 'other456'))).toBeNull();
    expect(validator(buildGroup('secret123', ''))).toBeNull();
    expect(validator(buildGroup(null, null))).toBeNull();
  });

  it('uses the given field names to look up controls', () => {
    const validator = passwordMatchValidator('newPassword', 'confirmPassword');
    const group = new FormGroup({
      newPassword: new FormControl('abc'),
      confirmPassword: new FormControl('def'),
    });

    expect(validator(group)).toEqual({ passwordsMismatch: true });
  });
});
