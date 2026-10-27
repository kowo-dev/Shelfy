import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { IconComponent } from '@shared/ui/icon/icon';
import { ShelfSectionComponent } from '@shared/ui/shelf-section/shelf-section';
import { formatRating } from '@shared/utils/collection-rating.util';
import type { HomeMood } from '../../data-access/home-mood';
import type { HomeArtResolver } from '../../data-access/home-art';
import { HomeTileComponent } from '../home-tile/home-tile';

@Component({
  selector: 'shelfy-home-mood',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IconComponent, ShelfSectionComponent, HomeTileComponent],
  template: `
    @let view = copy();
    <shelfy-shelf-section
      [title]="'home.mood.title' | translate: { genre: view.genre }"
      [subtitle]="view.kicker"
      [moreLabel]="'home.mood.more' | translate: { genre: view.genreLower }"
      [moreRoute]="['/explore']"
      [moreQuery]="mood().more"
      rail="three"
    >
      @for (item of mood().items; track item.id) {
        <shelfy-home-tile [item]="item" [art]="art()">
          <span class="v-cap">
            <b>{{ item.media.title }}</b>
            @if (item.rating) {
              <span class="v-star"
                ><shelfy-icon name="star" size="14" [active]="true" />{{
                  rating(item.rating)
                }}</span
              >
            }
          </span>
          <span class="v-sub">{{ meta(item) }}</span>
        </shelfy-home-tile>
      }
    </shelfy-shelf-section>
  `,
  host: { class: 'block' },
})
export class HomeMoodComponent {
  private readonly translate = inject(TranslateService);

  mood = input.required<HomeMood>();
  typeLabel = input<string | null>(null);
  art = input<HomeArtResolver | null>(null);

  readonly copy = computed(() => {
    const lang = this.translate.lang();
    const mood = this.mood();
    const genre = this.translate.get('explore.criteria.' + mood.genre);
    const type = this.typeLabel();
    const kicker = this.translate.get('home.mood.kicker');
    return {
      kicker: type ? `${kicker} · ${type}` : kicker,
      genre,
      genreLower: genre.toLocaleLowerCase(lang),
    };
  });

  meta(item: CollectionItemResponse): string {
    const date = item.media.metadata?.['releaseDate'];
    const year = typeof date === 'string' && /^\d{4}/.test(date) ? date.slice(0, 4) : null;
    const type = this.translate.get('collection.media_type_one.' + item.media.mediaType);
    return [type, year].filter(Boolean).join(' · ');
  }

  readonly rating = formatRating;
}
