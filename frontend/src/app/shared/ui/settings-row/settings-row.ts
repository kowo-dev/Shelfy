import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'shelfy-settings-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-w-0">
      <p class="text-text text-[1.0625rem] font-bold">{{ title() }}</p>
      @if (description(); as text) {
        <p class="text-text-muted mt-1 max-w-[56ch] text-[0.9375rem] leading-normal">{{ text }}</p>
      }
    </div>
    <div class="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
      <ng-content />
    </div>
  `,
  host: {
    class:
      'flex min-h-19 flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6',
  },
})
export class SettingsRowComponent {
  title = input.required<string>();
  description = input<string | null>(null);
}
