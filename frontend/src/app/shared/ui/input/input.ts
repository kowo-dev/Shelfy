import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { IconComponent } from '@shared/ui/icon/icon';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { HIT_AREA_40 } from '@shared/ui/ui-recipes';
import { TextControl } from '@shared/ui/text-control';

let nextId = 0;

@Component({
  selector: 'shelfy-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TranslatePipe],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
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
      <div class="relative flex items-center">
        @if (prefixText()) {
          <span
            class="text-text-muted pointer-events-none absolute top-1/2 left-4.5 z-10 -translate-y-1/2 text-base font-semibold"
            aria-hidden="true"
            >{{ prefixText() }}</span
          >
        }
        @if (prefixIcon()) {
          <span
            class="text-text-muted pointer-events-none absolute top-1/2 left-4.5 z-10 flex -translate-y-1/2 items-center leading-none"
          >
            <shelfy-icon [name]="prefixIcon()!" size="lg" />
          </span>
        }
        <input
          [id]="id"
          [type]="effectiveType()"
          [value]="value()"
          [disabled]="isDisabled()"
          [placeholder]="placeholder()"
          [attr.aria-label]="label() ? null : ariaLabel() || placeholder() || null"
          [attr.maxlength]="maxlength()"
          [attr.autocomplete]="autocomplete()"
          [attr.aria-invalid]="error() ? 'true' : null"
          [attr.min]="min()"
          [attr.max]="max()"
          [attr.step]="step()"
          [class]="inputClasses()"
          (input)="handleInput($event)"
          (blur)="handleBlur()"
        />
        @if (passwordToggle()) {
          <button
            type="button"
            class="text-text-muted hover:text-text absolute! top-1/2 right-3.5 z-10 flex -translate-y-1/2 cursor-pointer items-center leading-none transition-[color,background-color,opacity] active:opacity-70"
            [class]="hitArea"
            [attr.aria-label]="
              (showPassword() ? 'auth.hide_password' : 'auth.show_password') | translate
            "
            [attr.aria-pressed]="showPassword()"
            (click)="toggleShow()"
          >
            <shelfy-icon [name]="showPassword() ? 'eye' : 'eyeClosed'" size="lg" />
          </button>
        } @else if (suffixIcon()) {
          <span
            class="text-text-muted pointer-events-none absolute top-1/2 right-4 z-10 -translate-y-1/2"
          >
            <shelfy-icon [name]="suffixIcon()!" size="lg" />
          </span>
        }
      </div>
      @if (error()) {
        <span class="form-error">{{ error() }}</span>
      } @else if (hint()) {
        <span class="form-hint">{{ hint() }}</span>
      }
    </div>
  `,
})
export class InputComponent extends TextControl {
  label = input<string>('');
  placeholder = input<string>('');
  error = input<string>('');
  hint = input<string>('');
  prefixIcon = input<string>('');
  prefixText = input<string>('');
  ariaLabel = input<string>('', { alias: 'aria-label' });
  maxlength = input<number | null>(null);
  autocomplete = input<string | null>(null);
  counter = input(false);
  suffixIcon = input<string>('');
  type = input<string>('text');
  min = input<string | number>('');
  max = input<string | number>('');
  step = input<string | number>('');
  passwordToggle = input(false);

  readonly showPassword = signal(false);
  readonly id = `shelfy-input-${nextId++}`;
  readonly hitArea = HIT_AREA_40;

  effectiveType = computed(() =>
    this.passwordToggle() && this.showPassword() ? 'text' : this.type(),
  );

  toggleShow(): void {
    this.showPassword.update((v) => !v);
  }

  inputClasses = computed(() => {
    const rightPad = this.suffixIcon() || this.passwordToggle() ? 'pr-13' : '';
    const leftPad = this.prefixIcon() ? 'pl-13' : this.prefixText() ? 'pl-9' : '';
    const error = this.error() ? 'form-control--error' : '';
    return `form-control form-control--md ${leftPad} ${rightPad} ${error}`.trim();
  });
}
