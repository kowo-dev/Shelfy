import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { todayIsoDate } from '@shared/utils/local-date.util';
import { dayParts } from '../../data-access/home-dates';
import type { SoonDay } from '../../data-access/home-discovery';
import type { HomeFilter } from '../../data-access/home-discovery';
import { ShelfSectionComponent } from '@shared/ui/shelf-section/shelf-section';
import { MediaCardComponent } from '@shared/ui/media-card/media-card';

@Component({
  selector: 'shelfy-home-soon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, ShelfSectionComponent, MediaCardComponent],
  template: `
    <shelfy-shelf-section
      [title]="'home.coming_soon' | translate"
      [subtitle]="'home.coming_soon_sub' | translate"
      [moreLabel]="'home.see_all' | translate"
      [moreRoute]="['/discover', 'soon']"
      [moreQuery]="query()"
      rail="medium"
    >
      @for (entry of entries(); track entry.key) {
        <div class="day">
          <div class="day-head">
            <b>{{ entry.parts.day }}</b>
            <span
              >{{ entry.parts.month }}<small>{{ entry.when }}</small></span
            >
          </div>
          <shelfy-media-card [item]="entry.item" [subtitle]="entry.type" />
        </div>
      }
    </shelfy-shelf-section>
  `,
  host: { class: 'block' },
})
export class HomeSoonComponent {
  private readonly translate = inject(TranslateService);

  filter = input<HomeFilter>('all');
  readonly query = computed(() => (this.filter() === 'all' ? {} : { type: this.filter() }));

  groups = input.required<SoonDay[]>();

  readonly entries = computed(() => {
    const lang = this.translate.lang();
    const today = todayIsoDate();
    return this.groups().flatMap((group) => {
      const parts = dayParts(group.date, today, lang);
      const when =
        parts.days === 1
          ? this.translate.get('home.tomorrow_lower')
          : this.translate.get('home.in_days', { count: parts.days });
      return group.items.map((item) => ({
        key: item.id,
        item,
        parts,
        when,
        type: this.translate.get('collection.media_type_one.' + item.media.mediaType),
      }));
    });
  });
}
