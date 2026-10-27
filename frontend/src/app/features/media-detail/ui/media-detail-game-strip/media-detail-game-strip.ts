import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import type { GameSummary } from '@app/core/services/igdb/igdb.model';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { ShelfSectionComponent } from '@shared/ui/shelf-section/shelf-section';
import { MediaRailCardComponent } from '../media-rail-card/media-rail-card';

@Component({
  selector: 'shelfy-media-detail-game-strip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, MediaRailCardComponent, ShelfSectionComponent],
  templateUrl: './media-detail-game-strip.html',
  host: { class: 'contents' },
})
export class MediaDetailGameStripComponent {
  private readonly igdb = inject(IgdbService);

  readonly games = input.required<GameSummary[]>();
  readonly headingKey = input.required<string>();

  coverUrl(game: GameSummary): string | null {
    return this.igdb.imageUrl(game.coverImageId, 't_1080p');
  }
}
