import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import { RatingValueComponent } from '@shared/ui/rating-value/rating-value';
import { formatRating, ratingColor } from '@shared/utils/collection-rating.util';
import {
  displayScore,
  heatColor,
  seasonAverage,
  type EpisodeCell,
  type RatingSource,
  type SeasonColumn,
} from '../episode-grid.util';

export const SEASON_ARROW =
  'text-text grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-white/8 transition-[background-color,opacity] hover:bg-white/16 disabled:cursor-default disabled:bg-white/5 disabled:opacity-30';
const LAYOUT = {
  vertical: { label: 40, column: 88 },
  horizontal: { label: 112, column: 60 },
};
const GAP_PX = 8;
const CELL = 'relative grid h-12 min-w-0 place-items-center rounded-xl tabular-nums';
const PEEK_WIDTH_PX = 288;
const PEEK_ROOM_PX = 300;
const HEAD =
  'flex cursor-pointer rounded-2xl transition-colors duration-300 hover:bg-white/6 aria-pressed:bg-white/8';

@Component({
  selector: 'shelfy-rating-matrix',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, NgTemplateOutlet, RatingValueComponent, TranslatePipe],
  host: { class: 'relative block min-w-0' },
  template: `
    <div class="mb-4 flex min-h-11 flex-wrap items-center gap-x-5 gap-y-2">
      <span class="text-text-muted inline-flex items-center gap-2 text-sm font-semibold">
        <span class="size-3.5 rounded-[5px] bg-(--color-rating-good)" aria-hidden="true"></span>
        {{ 'media.tracker.source.mine' | translate }}
      </span>
      <span class="text-text-muted inline-flex items-center gap-2 text-sm font-semibold">
        <span
          class="h-3.5 w-9 rounded-[5px] bg-linear-to-r from-(--color-rating-low) via-(--color-rating-mid) to-(--color-rating-high) opacity-45"
          aria-hidden="true"
        ></span>
        {{ 'media.tracker.source.' + source() | translate }}
      </span>
      @if (paged()) {
        <div class="ml-auto flex gap-2">
          <button
            type="button"
            [class]="arrow"
            [disabled]="!canPrevious()"
            [attr.aria-label]="'profile.rail.previous' | translate"
            (click)="page(-1)"
          >
            <shelfy-icon name="chevronLeft" size="20" />
          </button>
          <button
            type="button"
            [class]="arrow"
            [disabled]="!canNext()"
            [attr.aria-label]="'profile.rail.next' | translate"
            (click)="page(1)"
          >
            <shelfy-icon name="chevronRight" size="20" />
          </button>
        </div>
      }
    </div>
    @if (horizontal()) {
      <div class="grid w-max items-center gap-2" [style.grid-template-columns]="template()">
        <span aria-hidden="true"></span>
        @for (n of shownNumbers(); track n) {
          <span class="text-text-subtle text-center text-sm font-semibold tabular-nums"
            >E{{ n }}</span
          >
        }
        @for (season of columns(); track season.season) {
          @let avg = averageOf(season);
          @let on = selectedSeason() === season.season;
          <button
            type="button"
            class="h-12 items-center gap-2.5 px-3"
            [class]="head"
            [attr.data-season]="season.season"
            [attr.aria-pressed]="on"
            (click)="seasonSelected.emit(season.season)"
          >
            <span
              class="font-display text-lg leading-none font-extrabold tracking-[-0.03em] whitespace-nowrap"
              [class]="on ? 'text-text' : 'text-text-muted'"
              >{{ seasonLabel(season) }}</span
            >
            @if (avg === null) {
              <span class="font-display text-text-subtle text-sm font-extrabold">–</span>
            } @else {
              <shelfy-rating-value
                class="font-display text-sm font-extrabold"
                starSize="13"
                [value]="avg"
                [color]="averageColor(season, avg)"
              />
            }
          </button>
          @for (n of shownNumbers(); track n) {
            <ng-container
              *ngTemplateOutlet="slot; context: { $implicit: season.episodes[n - 1] }"
            />
          }
        }
      </div>
    } @else {
      <div
        #swiper
        class="[scrollbar-width:none] max-md:-mx-(--frame-x) max-md:overflow-x-auto max-md:overscroll-x-contain max-md:px-(--frame-x) [&::-webkit-scrollbar]:hidden"
      >
        <div class="grid w-max items-center gap-2" [style.grid-template-columns]="template()">
          <span class="self-stretch" aria-hidden="true"></span>
          @for (season of shownColumns(); track season.season) {
            @let avg = averageOf(season);
            @let on = selectedSeason() === season.season;
            <button
              type="button"
              class="mb-2 w-full flex-col items-center gap-1.5 py-3"
              [class]="head"
              [attr.data-season]="season.season"
              [attr.aria-pressed]="on"
              (click)="seasonSelected.emit(season.season)"
            >
              <span
                class="font-display text-[1.375rem] leading-none font-extrabold tracking-[-0.04em] whitespace-nowrap"
                [class]="on ? 'text-text' : 'text-text-muted'"
                >{{ seasonLabel(season) }}</span
              >
              @if (avg === null) {
                <span class="font-display text-text-subtle text-[0.9375rem] font-extrabold">–</span>
              } @else {
                <shelfy-rating-value
                  class="font-display text-[0.9375rem] font-extrabold"
                  starSize="14"
                  [value]="avg"
                  [color]="averageColor(season, avg)"
                />
              }
            </button>
          }
          @for (n of shownNumbers(); track n) {
            <span
              class="text-text-subtle grid h-12 items-center self-stretch text-sm font-semibold tabular-nums"
              >E{{ n }}</span
            >
            @for (season of shownColumns(); track season.season) {
              <ng-container
                *ngTemplateOutlet="slot; context: { $implicit: season.episodes[n - 1] }"
              />
            }
          }
        </div>
      </div>
    }

    <ng-template #slot let-cell>
      @if (cell && cell.released) {
        @let score = scoreOf(cell);
        <button
          type="button"
          data-cell
          class="cursor-pointer transition-[box-shadow,translate] duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_0_2px_rgb(230_211_179/0.6)] focus-visible:shadow-[0_0_0_2px_rgb(230_211_179/0.75)] focus-visible:outline-none motion-reduce:transition-none"
          [class]="cellClass"
          [style.background-color]="background(cell, score)"
          [style.color]="score === null ? null : cellColor(cell, score)"
          [attr.data-watched]="cell.watched || null"
          [attr.aria-label]="cellLabel(cell, score)"
          (pointerenter)="peekAt($event, cell)"
          (pointerleave)="peek.set(null)"
          (focus)="peekAt($event, cell)"
          (blur)="peek.set(null)"
          (click)="peek.set(null); cellSelected.emit(cell)"
        >
          @if (score !== null) {
            <span class="font-display text-base font-extrabold">{{ format(score) }}</span>
          }
        </button>
      } @else if (cell) {
        <span class="bg-white/3" [class]="cellClass" [title]="cellLabel(cell, null)"></span>
      } @else {
        <span aria-hidden="true"></span>
      }
    </ng-template>

    @if (peek(); as p) {
      @let c = p.cell;
      @let score = scoreOf(c);
      <div
        role="tooltip"
        class="animate-fade-in pointer-events-none absolute z-40 w-72 overflow-hidden rounded-[1.125rem] bg-[rgb(30_30_30/0.96)] shadow-[0_24px_50px_-18px_#000,inset_0_0_0_1px_rgb(255_255_255/0.06)] backdrop-blur-xl"
        [style.left.px]="p.left"
        [style.top.px]="p.top"
        [style.translate]="p.above ? '0 -100%' : null"
      >
        @if (still(c); as url) {
          <img [src]="url" alt="" class="bg-surface-3 aspect-video w-full object-cover" />
        }
        <div class="p-3.5">
          <p class="text-text-muted text-xs font-semibold tabular-nums">
            S{{ c.season }} · E{{ c.episode }}
            @if (airDate(c); as date) {
              <span class="text-text-subtle"> · {{ date }}</span>
            }
          </p>
          <p class="text-text mt-1 line-clamp-2 text-[0.9375rem] leading-tight font-semibold">
            {{ c.title || 'S' + c.season + 'E' + c.episode }}
          </p>
          <p
            class="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] font-semibold"
          >
            @if (score !== null) {
              <span class="inline-flex items-center gap-1">
                <shelfy-icon
                  name="star"
                  size="14"
                  [active]="true"
                  [style.color]="c.mine === null ? heat(score) : mineColor(score)"
                />
                <b class="text-text tabular-nums">{{ format(score) }}</b>
                <span class="text-text-muted">{{
                  (c.mine === null ? 'media.tracker.source.' + source() : 'media.your_rating')
                    | translate
                }}</span>
              </span>
            }
            @if (c.watched) {
              <span class="text-status-done inline-flex items-center gap-1">
                <shelfy-icon name="checkCircle" size="14" [active]="true" />
                {{ 'media.tracker.watched' | translate }}
              </span>
            }
            @if (c.runtime) {
              <span class="text-text-subtle tabular-nums">{{ c.runtime }} min</span>
            }
          </p>
        </div>
      </div>
    }
  `,
})
export class RatingMatrixComponent {
  private readonly translate = inject(TranslateService);
  private readonly tmdb = inject(TmdbService);
  private readonly dateFormat = inject(DateFormatService);

  readonly columns = input.required<SeasonColumn[]>();
  readonly source = input.required<RatingSource>();
  readonly selectedSeason = input<number | null>(null);
  readonly orientation = input<'vertical' | 'horizontal'>('vertical');
  readonly cellSelected = output<EpisodeCell>();
  readonly seasonSelected = output<number>();

  readonly cellClass = CELL;
  readonly head = HEAD;
  readonly arrow = SEASON_ARROW;
  readonly format = formatRating;
  readonly heat = heatColor;
  readonly mineColor = ratingColor;
  readonly peek = signal<{ cell: EpisodeCell; left: number; top: number; above: boolean } | null>(
    null,
  );

  readonly horizontal = computed(() => this.orientation() === 'horizontal');
  readonly episodeNumbers = computed(() => {
    const longest = Math.max(0, ...this.columns().map((c) => c.episodes.length));
    return Array.from({ length: longest }, (_, i) => i + 1);
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly width = signal(0);
  private readonly start = signal(0);
  readonly swipe = signal(false);

  readonly total = computed(() =>
    this.horizontal() ? this.episodeNumbers().length : this.columns().length,
  );
  readonly perPage = computed(() => {
    const width = this.width();
    if (width === 0 || this.swipe()) return Math.max(1, this.total());
    const { label, column } = LAYOUT[this.orientation()];
    return Math.max(1, Math.floor((width - label) / (column + GAP_PX)));
  });
  readonly firstShown = computed(() =>
    Math.min(this.start(), Math.max(0, this.total() - this.perPage())),
  );
  private readonly window = computed(() => [this.firstShown(), this.firstShown() + this.perPage()]);
  readonly shownColumns = computed(() =>
    this.horizontal() ? this.columns() : this.columns().slice(...this.window()),
  );
  readonly shownNumbers = computed(() =>
    this.horizontal() ? this.episodeNumbers().slice(...this.window()) : this.episodeNumbers(),
  );
  readonly paged = computed(() => this.total() > this.perPage());
  readonly canPrevious = computed(() => this.firstShown() > 0);
  readonly canNext = computed(() => this.firstShown() + this.perPage() < this.total());
  readonly template = computed(() => {
    const { label, column } = LAYOUT[this.orientation()];
    const count = this.horizontal() ? this.shownNumbers().length : this.shownColumns().length;
    return `${label}px repeat(${count}, ${column}px)`;
  });

  constructor() {
    afterNextRender(() => {
      const phone = globalThis.matchMedia?.('(width < 48rem)');
      if (phone) {
        const sync = () => this.swipe.set(phone.matches && !this.horizontal());
        sync();
        phone.addEventListener('change', sync);
        this.destroyRef.onDestroy(() => phone.removeEventListener('change', sync));
      }
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() =>
        this.width.set(this.host.nativeElement.clientWidth),
      );
      observer.observe(this.host.nativeElement);
      this.width.set(this.host.nativeElement.clientWidth);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
    effect(() => {
      const index = this.columns().findIndex((c) => c.season === this.selectedSeason());
      const perPage = this.perPage();
      untracked(() => {
        if (index < 0 || this.horizontal()) return;
        if (index < this.firstShown()) this.start.set(index);
        else if (index >= this.firstShown() + perPage) this.start.set(index - perPage + 1);
      });
    });
  }

  page(direction: 1 | -1): void {
    const last = Math.max(0, this.total() - this.perPage());
    this.start.set(Math.max(0, Math.min(last, this.firstShown() + direction * this.perPage())));
  }

  peekAt(event: Event, cell: EpisodeCell): void {
    const target = event.currentTarget as HTMLElement;
    const pointer = (event as Partial<PointerEvent>).pointerType;
    if (pointer !== undefined && pointer !== 'mouse') return;
    if (event.type === 'focus' && !target.matches(':focus-visible')) return;
    const cellBox = target.getBoundingClientRect();
    const hostBox = this.host.nativeElement.getBoundingClientRect();
    const width = PEEK_WIDTH_PX;
    const centre = cellBox.left + cellBox.width / 2 - width / 2;
    const left = Math.min(Math.max(12, centre), window.innerWidth - width - 12) - hostBox.left;
    const above = cellBox.top > PEEK_ROOM_PX;
    const top = (above ? cellBox.top - 10 : cellBox.bottom + 10) - hostBox.top;
    this.peek.set({ cell, left, top, above });
  }

  still(cell: EpisodeCell): string | null {
    return this.tmdb.imageUrl(cell.stillPath, 'w300');
  }

  airDate(cell: EpisodeCell): string | null {
    if (!cell.airDate) return null;
    return this.dateFormat.formatDate(new Date(`${cell.airDate}T12:00:00`), this.translate.lang());
  }

  scoreOf(cell: EpisodeCell): number | null {
    return displayScore(cell, this.source());
  }

  averageOf(column: SeasonColumn): number | null {
    return seasonAverage(column, this.source());
  }

  averageColor(column: SeasonColumn, score: number): string {
    return column.averages.mine === null ? heatColor(score) : ratingColor(score);
  }

  cellColor(cell: EpisodeCell, score: number): string {
    if (cell.mine !== null) return cell.watched ? 'var(--color-background)' : ratingColor(score);
    const heat = heatColor(score);
    return cell.watched ? heat : `color-mix(in oklch, ${heat} 60%, var(--color-background))`;
  }

  background(cell: EpisodeCell, score: number | null): string {
    if (score === null) return cell.watched ? 'rgb(255 255 255 / 0.1)' : 'rgb(255 255 255 / 0.04)';
    if (cell.mine !== null) {
      const mine = ratingColor(score);
      return cell.watched ? mine : `color-mix(in srgb, ${mine} 30%, var(--color-background))`;
    }
    return `color-mix(in oklch, ${heatColor(score)} ${cell.watched ? 24 : 10}%, var(--color-background))`;
  }

  seasonLabel(column: SeasonColumn): string {
    return this.translate.get('media.tracker.season_short', { season: column.season });
  }

  cellLabel(cell: EpisodeCell, score: number | null): string {
    const parts = [`S${cell.season}E${cell.episode}`];
    if (cell.title) parts.push(cell.title);
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
