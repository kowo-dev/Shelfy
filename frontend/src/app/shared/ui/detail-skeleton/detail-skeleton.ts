import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'shelfy-detail-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative isolate flex min-h-(--band-nav) flex-col justify-end" aria-hidden="true">
      <div class="bg-surface hero-fade absolute inset-0 -z-10"></div>
      <div class="px-gutter flex flex-col gap-2 pb-5 md:gap-3 md:pb-7">
        <div class="bg-fill-subtle h-12 w-72 max-w-full rounded-md"></div>
        <div class="bg-fill-subtle h-4 w-40 rounded-sm"></div>
      </div>
    </div>
    <div
      class="px-gutter grid grid-cols-[repeat(auto-fill,minmax(min(186px,100%),1fr))] gap-x-5.5 gap-y-10 pt-7"
      aria-hidden="true"
    >
      @for (i of slots(); track i) {
        <div class="flex flex-col gap-3">
          <div class="bg-fill-subtle aspect-2/3 rounded-md"></div>
          <div class="bg-fill-subtle h-4 w-3/4 rounded-sm"></div>
        </div>
      }
    </div>
  `,
  host: { class: 'block', role: 'status', '[attr.aria-busy]': 'true' },
})
export class DetailSkeletonComponent {
  count = input(12);
  protected readonly slots = computed(() => Array.from({ length: this.count() }, (_, i) => i));
}
