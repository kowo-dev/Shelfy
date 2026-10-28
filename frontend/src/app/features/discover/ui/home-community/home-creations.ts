import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { catchError, map, of } from 'rxjs';
import { ListsService } from '@app/core/services/lists/lists';
import type { MediaListSummaryResponse } from '@app/core/services/lists/lists.model';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { CreationTileComponent } from '@shared/ui/creation-card/creation-tile';
import { creationView, type CreationView } from '@shared/ui/creation-card/creation-view';
import { ShelfSectionComponent } from '@shared/ui/shelf-section/shelf-section';
import { COMMUNITY_MIN } from './home-reviews';

const LISTS = 8;
const SHOWN = 6;

interface CreationCard {
  id: string;
  list: MediaListSummaryResponse;
  view: CreationView | null;
}

const showable = (card: CreationCard): boolean =>
  !!card.view &&
  card.view.covers.length > 0 &&
  card.view.covers.every((cover) => cover.url && !cover.adult);

@Component({
  selector: 'shelfy-home-creations',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, CreationTileComponent, ShelfSectionComponent],
  template: `
    @if (cards().length >= min) {
      <shelfy-shelf-section
        [title]="'home.popular_lists' | translate"
        [subtitle]="'home.popular_lists_sub' | translate"
        [moreLabel]="'home.community' | translate"
        [moreRoute]="['/creations']"
        [rail]="null"
      >
        <div class="card-grid">
          @for (card of cards().slice(0, 3); track card.id) {
            <shelfy-creation-tile [list]="card.list" />
          }
        </div>
      </shelfy-shelf-section>
    }
  `,
  host: { class: 'block' },
})
export class HomeCreationsComponent {
  private readonly lists = inject(ListsService);
  readonly cards = signal<CreationCard[]>([]);

  protected readonly min = COMMUNITY_MIN;

  constructor() {
    const query = { scope: 'ALL', sort: 'POPULAR' } as const;
    this.lists
      .browse(0, LISTS, query)
      .pipe(
        map((page) => page.content),
        catchError(() => of([])),
      )
      .subscribe((lists) =>
        this.cards.set(
          lists
            .filter((list) => list.previewMedia.length)
            .map((list) => ({ id: `list-${list.id}`, list, view: creationView({ list }) }))
            .filter(showable)
            .sort((a, b) => b.view!.likes - a.view!.likes)
            .slice(0, SHOWN),
        ),
      );
  }
}
