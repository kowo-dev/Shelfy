import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import { RatingValueComponent } from '@shared/ui/rating-value/rating-value';
import { RatingSliderComponent } from '@shared/ui/rating-slider/rating-slider';
import {
  EXTERNAL_RATING_COLOR,
  formatRating,
  ratingToTextColor,
} from '@shared/utils/collection-rating.util';
import { displayScore, scoreOf, type EpisodeCell, type RatingSource } from '../episode-grid.util';

@Component({
  selector: 'shelfy-episode-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RatingValueComponent, RatingSliderComponent, TranslatePipe],
  host: {
    class: 'block min-w-0',
    '[attr.data-episode]': 'cell().episode',
  },
  template: `
    @let ep = cell();
    <div class="v-tile cursor-default">
      <span
        class="v-art outline-3 outline-offset-3"
        [class]="
          (highlighted() ? 'outline-accent ' : 'outline-transparent ') +
          (ep.released ? '' : 'opacity-45')
        "
      >
        <button
          type="button"
          class="block size-full outline-offset-4"
          [class.cursor-pointer]="ep.released"
          [attr.aria-label]="label()"
          [attr.aria-disabled]="!ep.released || null"
          (click)="opened.emit()"
        >
          @if (stillUrl(); as still) {
            <img
              [src]="still"
              alt=""
              loading="lazy"
              class="size-full object-cover"
              draggable="false"
            />
          } @else {
            <span
              class="font-display text-text-subtle grid size-full place-items-center text-[1.875rem] font-extrabold tabular-nums"
              aria-hidden="true"
              >{{ ep.episode }}</span
            >
          }
        </button>
        @if (editable() && ep.released) {
          <button
            type="button"
            class="v-add show"
            [class.done]="ep.watched"
            [attr.aria-pressed]="ep.watched"
            [attr.aria-label]="
              (ep.watched ? 'media.tracker.watched' : 'media.tracker.mark_watched') | translate
            "
            (click)="watchedToggled.emit(!ep.watched)"
          >
            <shelfy-icon name="check" size="20" />
          </button>
        }
      </span>
      <span class="v-cap">
        <b
          ><span class="text-text-subtle tabular-nums">E{{ ep.episode }}</span>
          @if (ep.title) {
            · {{ ep.title }}
          }
        </b>
        @if (external(); as value) {
          <shelfy-rating-value
            class="shrink-0 text-[0.9375rem] font-bold"
            starSize="14"
            [value]="value"
            [color]="externalColor"
            [label]="sourceLabel()"
          />
        }
      </span>
      @if (!ep.released) {
        <span class="v-sub">{{ 'media.tracker.not_aired' | translate }}</span>
      } @else if (editable()) {
        <div class="mt-2.5 flex items-center gap-3.5">
          <shelfy-rating-slider
            size="md"
            [value]="ep.mine"
            [label]="'media.tracker.rate_episode' | translate: { episode: ep.episode }"
            (changed)="rated.emit($event)"
            (previewed)="preview.set($event)"
          />
          <b
            class="font-display text-[1.375rem] leading-none font-extrabold tabular-nums"
            [style.color]="mineColor()"
            aria-hidden="true"
            >{{ mineText() }}</b
          >
        </div>
      }
    </div>
  `,
})
export class EpisodeRowComponent {
  private readonly tmdb = inject(TmdbService);
  private readonly translate = inject(TranslateService);

  readonly cell = input.required<EpisodeCell>();
  readonly source = input.required<RatingSource>();
  readonly editable = input(false);
  readonly highlighted = input(false);

  readonly opened = output<void>();
  readonly watchedToggled = output<boolean>();
  readonly rated = output<number | null>();
  readonly stillUrl = computed(() => this.tmdb.imageUrl(this.cell().stillPath, 'w300'));
  readonly external = computed(() => scoreOf(this.cell(), this.source()));
  readonly sourceLabel = computed(() =>
    this.source() === 'tmdb' ? 'TMDB' : this.translate.get('media.tracker.source.' + this.source()),
  );
  readonly externalColor = EXTERNAL_RATING_COLOR;
  readonly preview = signal<number | null>(null);
  private readonly shownMine = computed(() => this.preview() ?? this.cell().mine);
  readonly mineText = computed(() => {
    const rating = this.shownMine();
    return rating === null ? '–' : formatRating(rating);
  });
  readonly mineColor = computed(() => {
    const rating = this.shownMine();
    return rating === null ? 'var(--color-text-subtle)' : ratingToTextColor(rating, 100);
  });

  label(): string {
    const cell = this.cell();
    const parts = [`S${cell.season}E${cell.episode}`];
    if (cell.title) parts.push(cell.title);
    const score = displayScore(cell, this.source());
    if (score !== null) parts.push(formatRating(score));
    parts.push(
      this.translate.get(
        !cell.released
          ? 'media.tracker.not_aired'
          : cell.watched
            ? 'media.tracker.watched'
            : 'media.tracker.not_watched',
      ),
    );
    return parts.join(' · ');
  }
}
