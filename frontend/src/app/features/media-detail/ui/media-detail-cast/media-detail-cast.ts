import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import type { CastMember } from '@app/core/services/tmdb/tmdb.model';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { RouterLink } from '@angular/router';
import { ShelfSectionComponent } from '@shared/ui/shelf-section/shelf-section';
import { personUrl } from '../../data-access/media-detail-links.util';

@Component({
  selector: 'shelfy-media-detail-cast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RouterLink, ShelfSectionComponent],
  templateUrl: './media-detail-cast.html',
  host: { class: 'contents' },
})
export class MediaDetailCastComponent {
  private readonly tmdb = inject(TmdbService);

  readonly cast = input.required<CastMember[]>();

  protected readonly personUrl = personUrl;

  castProfileUrl(profilePath: string | null): string | null {
    return this.tmdb.imageUrl(profilePath, 'w185');
  }
}
