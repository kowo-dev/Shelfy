import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  ViewEncapsulation,
} from '@angular/core';
import { NG_ICON_DIRECTIVES } from '@ng-icons/core';

@Component({
  selector: 'shelfy-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [NG_ICON_DIRECTIVES],
  host: {
    class: 'shelfy-icon cursor-pointer',
    '[attr.data-size]': 'resolvedSize()',
    '[style.--shelfy-icon-size]': 'pixelSize()',
    '[attr.data-active]': 'active() ? true : null',
  },
  template: `<ng-icon [name]="resolvedName()" />`,
})
export class IconComponent {
  name = input.required<string>();
  size = input<'sm' | 'md' | 'lg' | 'xl' | string>('md');
  active = input(false);

  resolvedSize = computed(() => {
    const map: Record<string, string> = { sm: '16', md: '18', lg: '20', xl: '24' };
    return map[this.size()] ?? this.size();
  });

  pixelSize = computed(() =>
    /^\d+$/.test(this.resolvedSize()) ? `${this.resolvedSize()}px` : null,
  );

  resolvedName = computed(() => (this.active() ? `${this.name()}Active` : this.name()));
}
