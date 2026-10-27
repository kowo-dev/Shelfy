import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';

@Component({
  selector: 'shelfy-adult-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <svg
      viewBox="0 0 48 48"
      role="img"
      class="block aspect-square h-auto"
      [style.width]="size()"
      [attr.aria-label]="'adult.hidden' | translate"
    >
      <circle cx="24" cy="24" r="22" fill="#d9483f" stroke="#fff" stroke-width="2.5" />
      <text
        x="24"
        y="30.5"
        text-anchor="middle"
        font-family="system-ui, sans-serif"
        font-size="19"
        font-weight="800"
        fill="#fff"
      >
        -18
      </text>
    </svg>
  `,
  host: { class: 'inline-block' },
})
export class AdultBadgeComponent {
  size = input('2.5rem');
}
