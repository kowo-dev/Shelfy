import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon';
import type { IconName } from '@shared/ui/icon/icon-registry';

@Component({
  selector: 'shelfy-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="animate-rise-in flex flex-col items-center px-5 py-16 text-center">
      @if (icon(); as iconName) {
        <span
          class="text-text-muted bg-surface mb-5 flex size-14 items-center justify-center rounded-lg"
        >
          <shelfy-icon [name]="iconName" size="lg" />
        </span>
      }
      @if (title(); as heading) {
        <p class="font-display text-text text-xl font-extrabold">
          {{ heading }}
        </p>
      }
      @if (hint(); as text) {
        <p class="text-text-muted mt-2 max-w-md text-base">{{ text }}</p>
      }
      <div class="mt-6 flex flex-col items-center empty:hidden"><ng-content /></div>
    </div>
  `,
})
export class EmptyStateComponent {
  icon = input<IconName | null>(null);
  title = input<string | null>(null);
  hint = input<string | null>(null);
}
