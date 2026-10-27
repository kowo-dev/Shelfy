import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { AniListCharacter } from '@app/core/services/anilist/anilist.model';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { ShelfSectionComponent } from '@shared/ui/shelf-section/shelf-section';
import { characterUrl, staffUrl } from '../../data-access/media-detail-links.util';

@Component({
  selector: 'shelfy-media-detail-characters',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, ShelfSectionComponent],
  templateUrl: './media-detail-characters.html',
  host: { class: 'contents' },
})
export class MediaDetailCharactersComponent {
  readonly animeCharacters = input.required<AniListCharacter[]>();
  readonly mangaCharacters = input.required<AniListCharacter[]>();

  protected readonly characterUrl = characterUrl;
  protected readonly staffUrl = staffUrl;

  readonly characters = computed(() =>
    this.animeCharacters().length > 0 ? this.animeCharacters() : this.mangaCharacters(),
  );
}
