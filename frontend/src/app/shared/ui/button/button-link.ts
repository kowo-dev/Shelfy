import { Directive, computed, input } from '@angular/core';
import { ButtonVariant, buttonClasses } from './button';

@Directive({
  selector: 'a[shelfyButtonLink]',
  standalone: true,
  host: {
    '[class]': 'classes()',
  },
})
export class ButtonLinkDirective {
  variant = input<ButtonVariant>('secondary');
  block = input(false);
  iconOnly = input(false);
  extraClass = input('');

  classes = computed(() =>
    buttonClasses({
      variant: this.variant(),
      block: this.block(),
      iconOnly: this.iconOnly(),
      extraClass: this.extraClass(),
    }),
  );
}
