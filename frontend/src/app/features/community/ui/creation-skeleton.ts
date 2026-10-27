import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CREATION_CARD_GRID } from '@shared/ui/ui-recipes';
import type { CommunityView } from '../data-access/community-url';

const PULSE = 'bg-fill-subtle animate-pulse motion-reduce:animate-none';

@Component({
  selector: 'shelfy-creation-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', 'aria-hidden': 'true' },
  template: `
    @if (!grid()) {
      <div class="mb-4 h-6 w-48 rounded-full" [class]="pulse"></div>
    }
    <div [class]="grid() ? gridClass : 'flex gap-3.5 overflow-hidden md:gap-5'">
      @for (slot of slots(); track slot) {
        <div [class]="grid() ? '' : 'w-75 shrink-0 md:w-100'">
          @if (kind() === 'reviews') {
            <div class="rounded-card h-55" [class]="pulse"></div>
          } @else {
            <div class="rounded-tile h-37.5 md:h-50" [class]="pulse"></div>
            <div class="mt-3 h-4 w-3/4 rounded-full" [class]="pulse"></div>
            <div class="mt-2 h-3.5 w-1/2 rounded-full" [class]="pulse"></div>
          }
        </div>
      }
    </div>
  `,
})
export class CreationSkeletonComponent {
  readonly grid = input(false);
  readonly kind = input<CommunityView>('reviews');
  protected readonly gridClass = CREATION_CARD_GRID;
  protected readonly pulse = PULSE;
  readonly slots = computed(() => Array.from({ length: this.grid() ? 9 : 4 }, (_, i) => i));
}
