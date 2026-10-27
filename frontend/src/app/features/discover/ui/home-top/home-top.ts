import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { MediaCardComponent } from '@shared/ui/media-card/media-card';
import type { HomeFilter } from '../../data-access/home-discovery';
import { ShelfSectionComponent } from '@shared/ui/shelf-section/shelf-section';

@Component({
  selector: 'shelfy-home-top',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, MediaCardComponent, ShelfSectionComponent],
  template: `
    <shelfy-shelf-section
      [title]="'home.top_ten' | translate"
      [subtitle]="'home.top_ten_sub' | translate"
      [moreLabel]="'home.see_all' | translate"
      [moreRoute]="['/discover', 'trending']"
      [moreQuery]="query()"
    >
      @for (item of items(); track item.id; let index = $index) {
        <shelfy-media-card [item]="item" [rank]="index + 1" />
      }
    </shelfy-shelf-section>
  `,
  host: { class: 'block' },
})
export class HomeTopComponent {
  filter = input<HomeFilter>('all');
  readonly query = computed(() => (this.filter() === 'all' ? {} : { type: this.filter() }));
  items = input.required<CollectionItemResponse[]>();
}
