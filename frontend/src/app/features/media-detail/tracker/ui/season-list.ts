import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { buttonClasses } from '@shared/ui/button/button';
import { IconComponent } from '@shared/ui/icon/icon';
import { RatingValueComponent } from '@shared/ui/rating-value/rating-value';
import { EXTERNAL_RATING_COLOR, ratingColor } from '@shared/utils/collection-rating.util';
import {
  seasonAverage,
  type EpisodeCell,
  type RatingSource,
  type SeasonColumn,
} from '../episode-grid.util';
import { EpisodeRowComponent } from './episode-row';

@Component({
  selector: 'shelfy-season-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EpisodeRowComponent, IconComponent, RatingValueComponent, TranslatePipe],
  host: { class: 'flex flex-col' },
  template: `
    @let s = season();
    @let avg = average();
    @let complete = s.released > 0 && s.watched >= s.released;
    <div class="flex flex-wrap items-center gap-x-4 gap-y-3 pb-6">
      <p class="flex min-w-0 items-center gap-3">
        @if (avg === null) {
          <span class="font-display text-text-subtle text-xl leading-none font-extrabold">–</span>
        } @else {
          <shelfy-rating-value
            class="font-display text-xl leading-none font-extrabold"
            starSize="24"
            [value]="avg"
            [color]="color(avg)"
          />
        }
        <span class="text-text-muted truncate text-base tabular-nums">
          {{ 'media.progress.season_count' | translate: { watched: s.watched, total: s.released } }}
        </span>
      </p>
      @if (editable() && s.released > 0) {
        <button
          type="button"
          [class]="secondary"
          [attr.aria-pressed]="complete"
          (click)="seasonToggled.emit(s)"
        >
          <shelfy-icon name="check" size="18" />
          {{ toggleLabel(complete) }}
        </button>
      }
    </div>
    <div
      #scroller
      class="grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
    >
      @for (cell of s.episodes; track cell.episode) {
        <shelfy-episode-row
          [cell]="cell"
          [source]="source()"
          [editable]="editable()"
          [highlighted]="highlighted() === cell.episode"
          (opened)="open(cell)"
          (watchedToggled)="watchedToggled.emit({ cell, watched: $event })"
          (rated)="rated.emit({ cell, rating: $event })"
        />
      }
    </div>
  `,
})
export class SeasonListComponent {
  private readonly translate = inject(TranslateService);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  readonly season = input.required<SeasonColumn>();
  readonly source = input.required<RatingSource>();
  readonly editable = input(false);
  readonly highlighted = input<number | null>(null);
  readonly episodeSelected = output<EpisodeCell>();
  readonly seasonToggled = output<SeasonColumn>();
  readonly watchedToggled = output<{ cell: EpisodeCell; watched: boolean }>();
  readonly rated = output<{ cell: EpisodeCell; rating: number | null }>();

  readonly secondary = buttonClasses({ variant: 'secondary', size: 'sm' });

  readonly average = computed(() => seasonAverage(this.season(), this.source()));

  constructor() {
    let initial = true;
    afterRenderEffect(() => {
      const highlighted = this.highlighted();
      const next = initial
        ? untracked(() => this.season().episodes.find((e) => e.released && !e.watched)?.episode)
        : undefined;
      const first = initial;
      initial = false;
      if (highlighted !== null) this.reveal(highlighted, !first);
      else if (next) this.align(next);
    });
  }

  private row(episode: number): HTMLElement | null | undefined {
    return this.scroller()?.nativeElement.querySelector<HTMLElement>(`[data-episode="${episode}"]`);
  }

  private reveal(episode: number, smooth: boolean): void {
    const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    this.row(episode)?.scrollIntoView({
      behavior: smooth && !reduced ? 'smooth' : 'auto',
      block: 'center',
    });
  }

  private align(episode: number): void {
    const el = this.scroller()?.nativeElement;
    const row = this.row(episode);
    if (el && row) el.scrollTop = row.offsetTop - el.offsetTop - 8;
  }

  open(cell: EpisodeCell): void {
    if (cell.released) this.episodeSelected.emit(cell);
  }

  color(score: number): string {
    return this.season().averages.mine === null ? EXTERNAL_RATING_COLOR : ratingColor(score);
  }

  toggleLabel(complete: boolean): string {
    return this.translate.get(
      complete ? 'media.tracker.unmark_season_n' : 'media.tracker.mark_season_n',
      { season: this.season().season },
    );
  }
}
