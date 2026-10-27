import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'shelfy-rail-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="animate-pulse motion-reduce:animate-none" aria-hidden="true">
      <div class="px-gutter">
        <div class="bg-fill-subtle h-[clamp(24px,2.4vw,34px)] w-56 max-w-[60%] rounded-md"></div>
      </div>
      <div class="px-gutter flex gap-5 overflow-hidden py-5">
        @for (i of slots(); track i) {
          <div class="rail-card shrink-0">
            <div class="bg-fill-subtle aspect-2/3 rounded-md"></div>
            <div class="bg-fill-subtle mt-3.5 h-4 w-3/4 rounded-sm"></div>
            <div class="bg-fill-subtle mt-1.5 h-3 w-1/2 rounded-sm"></div>
          </div>
        }
      </div>
    </div>
  `,
  host: { class: 'block' },
})
export class RailSkeletonComponent {
  count = input(8);
  protected readonly slots = computed(() => Array.from({ length: this.count() }, (_, i) => i));
}
