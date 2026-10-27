import { FormControl } from '@angular/forms';
import { maxBytesValidator } from './max-bytes-validator.util';

describe('maxBytesValidator', () => {
  const validate = (value: string) => maxBytesValidator(72)(new FormControl(value));

  it('accepts an empty value', () => {
    expect(validate('')).toBeNull();
  });

  it('accepts up to the limit and rejects one byte over', () => {
    expect(validate('a'.repeat(72))).toBeNull();
    expect(validate('a'.repeat(73))).toEqual({ maxbytes: { max: 72, actual: 73 } });
  });

  it('counts accented letters and emoji by their UTF-8 size', () => {
    expect(validate('é'.repeat(36))).toBeNull();
    expect(validate('é'.repeat(37))).toEqual({ maxbytes: { max: 72, actual: 74 } });
    expect(validate('🔒'.repeat(19))).toEqual({ maxbytes: { max: 72, actual: 76 } });
  });
});
