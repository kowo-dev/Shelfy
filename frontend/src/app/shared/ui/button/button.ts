import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SpinnerComponent } from '@shared/ui/spinner/spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export interface ButtonClassOptions {
  variant: ButtonVariant;
  size?: 'md' | 'sm';
  block?: boolean;
  iconOnly?: boolean;
  extraClass?: string;
}

const BUTTON_BASE =
  'duration-base inline-flex cursor-pointer items-center justify-center gap-2 leading-none font-medium whitespace-nowrap select-none transition-[color,background-color,opacity,box-shadow,scale] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 aria-busy:cursor-progress [&_*]:pointer-events-none [&_shelfy-icon]:self-center';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'satin font-semibold text-on-brand hover:brightness-[1.03] hover:shadow-[0_12px_30px_-14px_rgb(230_211_179/0.38)] disabled:shadow-none',
  secondary:
    'bg-button-secondary text-text backdrop-blur-xl hover:bg-button-secondary-hover aria-expanded:bg-button-secondary-hover aria-pressed:bg-text aria-pressed:font-semibold aria-pressed:text-background aria-pressed:hover:bg-primary-hover',
  danger: 'bg-danger-soft font-semibold text-danger-fg hover:bg-danger/25',
};

export function buttonClasses(options: ButtonClassOptions): string {
  const { variant, size = 'md', block, iconOnly, extraClass } = options;
  const sm = size === 'sm';
  return [
    BUTTON_BASE,
    sm ? 'rounded-[0.875rem]' : 'rounded-2xl',
    BUTTON_VARIANTS[variant],
    iconOnly
      ? sm
        ? 'size-11'
        : 'size-13'
      : sm
        ? 'h-11 px-4 text-[0.9375rem]'
        : 'h-13 px-5.5 text-base',
    block ? 'w-full' : '',
    extraClass ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

@Component({
  selector: 'shelfy-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent],
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [attr.aria-busy]="loading() ? 'true' : null"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-expanded]="ariaExpanded()"
      [attr.aria-pressed]="ariaPressed()"
      [attr.aria-controls]="ariaControls()"
      [attr.aria-haspopup]="ariaHaspopup()"
      [class]="classes()"
    >
      @if (loading()) {
        <shelfy-spinner size="sm" />
      }
      <ng-content />
    </button>
  `,
})
export class ButtonComponent {
  variant = input<ButtonVariant>('secondary');
  size = input<'md' | 'sm'>('md');
  loading = input(false);
  disabled = input(false);
  block = input(false);
  iconOnly = input(false);
  type = input<'button' | 'submit' | 'reset'>('button');
  extraClass = input('');
  ariaLabel = input<string | null>(null, { alias: 'aria-label' });
  ariaExpanded = input<boolean | null>(null, { alias: 'aria-expanded' });
  ariaPressed = input<boolean | null>(null, { alias: 'aria-pressed' });
  ariaControls = input<string | null>(null, { alias: 'aria-controls' });
  ariaHaspopup = input<'menu' | null>(null, { alias: 'aria-haspopup' });

  classes = computed(() =>
    buttonClasses({
      variant: this.variant(),
      size: this.size(),
      block: this.block(),
      iconOnly: this.iconOnly(),
      extraClass: this.extraClass(),
    }),
  );
}
