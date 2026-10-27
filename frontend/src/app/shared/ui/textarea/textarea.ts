import { ChangeDetectionStrategy, Component, forwardRef, input } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { TextControl } from '@shared/ui/text-control';

let nextId = 0;

@Component({
  selector: 'shelfy-textarea',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextareaComponent),
      multi: true,
    },
  ],
  template: `
    <div class="form-field">
      @if (label()) {
        <label [for]="id" class="form-label flex justify-between">
          {{ label() }}
          @if (counter() && maxlength()) {
            <span class="text-text-subtle text-sm font-normal tabular-nums"
              >{{ value().length }}/{{ maxlength() }}</span
            >
          }
        </label>
      }
      <textarea
        [id]="id"
        [value]="value()"
        [disabled]="isDisabled()"
        [placeholder]="placeholder()"
        [rows]="rows()"
        [attr.maxlength]="maxlength()"
        [attr.aria-label]="label() ? null : ariaLabel() || placeholder() || null"
        [attr.aria-invalid]="error() ? 'true' : null"
        [class]="'form-control form-control--textarea' + (error() ? ' form-control--error' : '')"
        (input)="handleInput($event)"
        (blur)="onTouched()"
      ></textarea>
      @if (error()) {
        <span class="form-error">{{ error() }}</span>
      }
    </div>
  `,
})
export class TextareaComponent extends TextControl {
  label = input<string>('');
  placeholder = input<string>('');
  error = input<string>('');
  ariaLabel = input<string>('', { alias: 'aria-label' });
  rows = input(4);
  maxlength = input<number | null>(null);
  counter = input(false);

  readonly id = `shelfy-textarea-${nextId++}`;
}
