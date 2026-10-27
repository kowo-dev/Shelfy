import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';

@Component({
  selector: 'shelfy-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <span
      [class]="classes()"
      class="border-t-transparent"
      [attr.aria-label]="'shared.loading' | translate"
      role="status"
    ></span>
  `,
})
export class SpinnerComponent {
  size = input<'sm' | 'md' | 'lg'>('md');

  classes = computed(() => {
    const sizes = { sm: 'size-3.5', md: 'size-4', lg: 'size-5' };
    return `block rounded-full border-2 border-current animate-spin motion-reduce:animate-[spin_1.6s_linear_infinite] ${sizes[this.size()]}`;
  });
}
