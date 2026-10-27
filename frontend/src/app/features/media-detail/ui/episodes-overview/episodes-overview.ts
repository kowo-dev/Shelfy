import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import { ShelfSectionComponent } from '@shared/ui/shelf-section/shelf-section';
import { RatingValueComponent } from '@shared/ui/rating-value/rating-value';
import { TabsComponent, type TabItem } from '@shared/ui/tabs/tabs';
import { MEDIA_CHIP } from '@shared/ui/ui-recipes';
import { EXTERNAL_RATING_COLOR, ratingToTextColor } from '@shared/utils/collection-rating.util';
import {
  scoreOf,
  type EpisodeCell,
  type RatingSource,
  type SeasonColumn,
} from '../../tracker/episode-grid.util';

const TOGGLE =
  'absolute top-2 right-2 grid size-9 cursor-pointer place-items-center rounded-full ring-2 ring-surface-raised/80 transition-colors active:scale-90';

@Component({
  selector: 'shelfy-episodes-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    ShelfSectionComponent,
    RatingValueComponent,
    TabsComponent,
    TranslatePipe,
  ],
  host: { class: 'block' },
  template: `
    <shelfy-shelf-section
      rail="soon"
      [title]="'media.tracker.episodes' | translate"
      [subtitle]="subtitle()"
      [moreLabel]="'profile.rail.view_all' | translate"
      [moreRoute]="trackerRoute()"
    >
      <ng-container ngProjectAs="[secTools]"><ng-content select="[epTools]" /></ng-container>
      @if (seasonTabs().length > 1) {
        <div secLead class="-mt-2 mb-5">
          <shelfy-tabs
            [tabs]="seasonTabs()"
            [activeId]="season() + ''"
            [label]="'media.tracker.seasons' | translate"
            (tabSelected)="season.set(+$event)"
          />
        </div>
      }
      @for (ep of episodes(); track ep.season + ':' + ep.episode) {
        <article class="group/card min-w-0">
          <div class="relative">
            <button
              type="button"
              class="bg-surface-raised relative block aspect-video w-full cursor-pointer overflow-hidden rounded-lg outline-offset-4"
              [class.opacity-45]="!ep.released"
              [attr.aria-label]="label(ep)"
              (click)="open(ep)"
            >
              @if (still(ep); as url) {
                <img
                  [src]="url"
                  alt=""
                  loading="lazy"
                  class="size-full object-cover"
                  draggable="false"
                />
              } @else {
                <span
                  class="font-display text-text-subtle grid size-full place-items-center text-[1.5rem] font-extrabold tabular-nums"
                  aria-hidden="true"
                  >{{ ep.episode }}</span
                >
              }
            </button>
            @if (editable() && ep.released) {
              <button
                type="button"
                [class]="toggleClass(ep)"
                [attr.aria-pressed]="ep.watched"
                [attr.aria-label]="
                  (ep.watched ? 'media.tracker.watched' : 'media.tracker.mark_watched') | translate
                "
                (click)="watchedToggled.emit({ cell: ep, watched: !ep.watched })"
              >
                <shelfy-icon name="check" size="sm" />
              </button>
            }
          </div>
          <div class="mt-3 flex min-w-0 items-baseline justify-between gap-3">
            <p class="min-w-0 truncate text-sm">
              <span class="text-text-subtle font-semibold tabular-nums">E{{ ep.episode }}</span>
              @if (ep.title) {
                <span class="text-text-subtle"> · </span>
                <span class="text-text font-medium">{{ ep.title }}</span>
              }
            </p>
            @if (ep.mine !== null) {
              <shelfy-rating-value
                class="shrink-0 text-xs"
                starSize="12"
                [value]="ep.mine"
                [color]="mineColor(ep.mine)"
              />
            } @else if (external(ep); as value) {
              <shelfy-rating-value
                class="shrink-0 text-xs"
                starSize="12"
                [value]="value"
                [color]="externalColor"
                [label]="sourceLabel()"
              />
            }
          </div>
          @if (!ep.released) {
            <p class="text-text-subtle mt-1 text-sm">
              {{ 'media.tracker.not_aired' | translate }}
            </p>
          }
        </article>
      }
    </shelfy-shelf-section>
  `,
})
export class EpisodesOverviewComponent {
  private readonly tmdb = inject(TmdbService);
  private readonly translate = inject(TranslateService);

  readonly columns = input.required<SeasonColumn[]>();
  readonly source = input.required<RatingSource>();
  readonly trackerRoute = input.required<string[]>();
  readonly editable = input(false);

  readonly watchedToggled = output<{ cell: EpisodeCell; watched: boolean }>();
  readonly episodeSelected = output<EpisodeCell>();
  readonly externalColor = EXTERNAL_RATING_COLOR;

  readonly season = linkedSignal(() => {
    const columns = this.columns();
    return (columns.find((c) => c.released > c.watched) ?? columns[0])?.season ?? 1;
  });
  readonly seasonTabs = computed<TabItem[]>(() => {
    this.translate.lang();
    return this.columns().map((c) => ({
      id: String(c.season),
      label: this.translate.get('media.tracker.season_short', { season: c.season }),
    }));
  });
  readonly episodes = computed(
    () => this.columns().find((c) => c.season === this.season())?.episodes ?? [],
  );
  readonly released = computed(() => this.columns().reduce((sum, c) => sum + c.released, 0));
  readonly subtitle = computed(() => {
    this.translate.lang();
    const watched = this.columns().reduce((sum, c) => sum + c.watched, 0);
    return this.editable()
      ? `${watched} / ${this.released()} ${this.translate.get('media.tracker.stat_watched')}`
      : null;
  });
  readonly sourceLabel = computed(() => {
    this.translate.lang();
    return this.translate.get('media.tracker.source.' + this.source());
  });

  still(cell: EpisodeCell): string | null {
    return this.tmdb.imageUrl(cell.stillPath, 'w500');
  }

  external(cell: EpisodeCell): number | null {
    return scoreOf(cell, this.source() === 'mine' ? 'tmdb' : this.source());
  }

  toggleClass(cell: EpisodeCell): string {
    return TOGGLE + (cell.watched ? ' bg-text text-background' : ' text-text ' + MEDIA_CHIP);
  }

  mineColor(rating: number): string {
    return ratingToTextColor(rating, 100);
  }

  label(cell: EpisodeCell): string {
    return `S${cell.season}E${cell.episode}` + (cell.title ? ` · ${cell.title}` : '');
  }

  open(cell: EpisodeCell): void {
    if (cell.released) this.episodeSelected.emit(cell);
  }
}
