import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'shelfy-hero-scrim',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents', 'aria-hidden': 'true' },
  template: `
    <span
      class="from-background via-background/75 absolute inset-0 -z-10 bg-linear-to-t via-30% to-transparent"
    ></span>
    <span
      class="from-background/85 via-background/25 absolute inset-0 -z-10 bg-linear-to-r via-45% to-transparent max-sm:hidden"
    ></span>
    <span
      class="from-scrim absolute inset-x-0 top-0 -z-10 h-40 bg-linear-to-b to-transparent"
    ></span>
  `,
})
export class HeroScrimComponent {}
