import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { AddSheetService } from '@app/core/services/add-sheet/add-sheet';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { ItemSheetService } from '@app/core/services/item-sheet/item-sheet';
import { ShelfLookupService } from '@app/core/services/shelf-lookup/shelf-lookup';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import { buildAddTarget } from '@shared/utils/add-target.util';
import { todayIsoDate } from '@shared/utils/local-date.util';
import { dayParts } from '../../data-access/home-dates';
import { releaseDateOf, type HomeSlide } from '../../data-access/home-discovery';
import type { HomeFilter } from '../../data-access/home-discovery';
import { ShelfSectionComponent } from '@shared/ui/shelf-section/shelf-section';
import { HomeTileComponent } from '../home-tile/home-tile';

@Component({
  selector: 'shelfy-home-anticipated',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IconComponent, ShelfSectionComponent, HomeTileComponent],
  template: `
    <shelfy-shelf-section
      [title]="'home.anticipated' | translate"
      [subtitle]="'home.anticipated_sub' | translate"
      [moreLabel]="'home.see_all' | translate"
      [moreRoute]="['/discover', 'upcoming']"
      [moreQuery]="query()"
      rail="big"
    >
      @for (tile of tiles(); track tile.key) {
        <shelfy-home-tile [item]="tile.item" [wide]="tile.image" [addable]="false">
          <span class="v-ant-cap">
            <span class="d">{{ tile.date }}</span>
            <span class="flex min-w-0 flex-1 flex-col gap-0.5">
              <b>{{ tile.title }}</b>
              <span>{{ tile.meta }}</span>
            </span>
            <button
              type="button"
              class="v-mini-btn"
              [class.done]="!!tile.owned"
              aria-haspopup="dialog"
              [attr.aria-label]="
                (tile.owned ? 'home.edit_on_shelf' : 'home.add_backlog')
                  | translate: { title: tile.title }
              "
              (click)="$event.stopPropagation(); act(tile.item, tile.owned)"
            >
              <shelfy-icon [name]="tile.owned ? 'check' : 'plus'" size="16" />
              {{ 'home.backlog' | translate }}
            </button>
          </span>
        </shelfy-home-tile>
      }
    </shelfy-shelf-section>
  `,
  host: { class: 'block' },
})
export class HomeAnticipatedComponent {
  private readonly lookup = inject(ShelfLookupService);
  private readonly addSheet = inject(AddSheetService);
  private readonly itemSheet = inject(ItemSheetService);
  private readonly translate = inject(TranslateService);

  filter = input<HomeFilter>('all');
  readonly query = computed(() => (this.filter() === 'all' ? {} : { type: this.filter() }));

  slides = input.required<HomeSlide[]>();

  readonly tiles = computed(() => {
    const lang = this.translate.lang();
    const today = todayIsoDate();
    return this.slides().map((slide) => {
      const { media } = slide.item;
      const iso = releaseDateOf(slide.item) ?? today;
      const parts = dayParts(iso, today, lang);
      return {
        key: slide.item.id,
        item: slide.item,
        owned: this.lookup.find(media),
        image: slide.art?.card ?? null,
        title: media.title,
        meta: `${this.translate.get('collection.media_type_one.' + media.mediaType)} · ${
          parts.days === 1
            ? this.translate.get('home.tomorrow_lower')
            : this.translate.get('home.in_days', { count: parts.days })
        }`,
        date: `${parts.month} ${parts.day}`,
      };
    });
  });

  constructor() {
    effect(() => {
      for (const slide of this.slides()) this.lookup.request(slide.item.media);
    });
  }

  act(item: CollectionItemResponse, owned: CollectionItemResponse | null): void {
    if (owned) {
      this.itemSheet.open(owned);
      return;
    }
    this.addSheet.open(
      buildAddTarget(item, this.translate.get('collection.media_type_one.' + item.media.mediaType)),
    );
  }
}
