import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { AvatarComponent } from '@shared/ui/avatar/avatar';
import { buttonClasses } from '@shared/ui/button/button';
import { FOCUSABLE, trapTab } from '@shared/ui/focus-trap/focus-trap';
import { IconComponent } from '@shared/ui/icon/icon';
import { RatingBlockComponent } from '@shared/ui/rating-block/rating-block';
import { RatingRingComponent } from '@shared/ui/rating-ring/rating-ring';
import { SHEET_RECIPES, SheetDrag } from '@shared/ui/side-sheet/sheet-drag';
import { collectionStatusColor } from '@shared/utils/collection-status.util';
import { formatRating } from '@shared/utils/collection-rating.util';
import { heatColor, type EpisodeCell } from '../episode-grid.util';
import { SEASON_ARROW } from './rating-matrix';

@Component({
  selector: 'shelfy-episode-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent,
    IconComponent,
    RatingBlockComponent,
    RatingRingComponent,
    RouterLink,
    TranslatePipe,
  ],
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    @let ep = cell();
    <div
      [class]="
        recipes.scrim +
        (closing()
          ? ' duration-fast opacity-0 transition-opacity'
          : ' duration-base transition-opacity starting:opacity-0')
      "
      aria-hidden="true"
      (click)="requestClose()"
    ></div>

    <div class="pointer-events-none fixed inset-0 z-85">
      <aside
        #panel
        role="dialog"
        aria-modal="true"
        aria-labelledby="episode-sheet-title"
        class="bg-surface rounded-t-sheet pointer-events-auto absolute inset-x-0 bottom-0 flex max-h-[94dvh] flex-col overflow-hidden shadow-[0_30px_80px_-20px_rgb(0_0_0/0.7),inset_0_1px_0_rgb(255_255_255/0.06),0_0_0_1px_rgb(255_255_255/0.06)] sm:inset-x-[max(0.75rem,calc(50%-23rem))] sm:max-h-[min(88dvh,52rem)]"
        [class]="closing() ? 'animate-sheet-out' : 'animate-sheet-in'"
        [style.translate]="drag.translate()"
        [style.transition]="drag.dragging() ? 'none' : dragSettle"
        (animationend)="onPanelAnimationEnd($event)"
      >
        <div
          [class]="handleClass"
          (pointerdown)="drag.start($event)"
          (pointermove)="drag.move($event)"
          (pointerup)="drag.end()"
          (pointercancel)="drag.end()"
        >
          <span [class]="recipes.handleBar" aria-hidden="true"></span>
        </div>

        <button
          type="button"
          class="bg-media-chip absolute top-3.5 right-3.5 z-10 grid size-10 cursor-pointer place-items-center rounded-full text-white backdrop-blur-[14px] transition-colors hover:bg-[rgb(14_17_22/0.85)]"
          [attr.aria-label]="'dialog.close' | translate"
          (click)="requestClose()"
        >
          <shelfy-icon name="close" size="sm" />
        </button>

        <div
          class="flex min-h-0 flex-1 [scrollbar-width:none] flex-col overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:hidden"
        >
          @if (stillUrl(); as still) {
            <div
              class="relative h-48 shrink-0 overflow-hidden sm:h-64"
              (pointerdown)="drag.start($event)"
              (pointermove)="drag.move($event)"
              (pointerup)="drag.end()"
              (pointercancel)="drag.end()"
            >
              @for (src of [still]; track src) {
                <img
                  [src]="src"
                  alt=""
                  class="animate-fade-in absolute inset-0 size-full object-cover"
                  style="mask-image: linear-gradient(180deg, #000 45%, transparent)"
                  draggable="false"
                />
              }
            </div>
          }

          <header
            class="relative shrink-0 px-5 sm:px-6.5"
            [class]="stillUrl() ? '-mt-16 sm:-mt-20' : 'pt-14 sm:pt-16'"
            (pointerdown)="drag.start($event)"
            (pointermove)="drag.move($event)"
            (pointerup)="drag.end()"
            (pointercancel)="drag.end()"
          >
            <div class="flex items-end gap-4">
              <div class="min-w-0 flex-1">
                <p class="text-text-muted text-sm font-semibold tabular-nums">
                  {{ code() }}
                  @if (facts(); as line) {
                    <span class="text-text-subtle"> · {{ line }}</span>
                  }
                </p>
                <h2
                  id="episode-sheet-title"
                  class="font-display text-text mt-1.5 line-clamp-3 text-[1.625rem] leading-[0.98] font-extrabold tracking-[-0.045em] text-balance sm:text-[2rem]"
                >
                  {{ ep.title || code() }}
                </h2>
              </div>
              @if (hasPrevious() || hasNext()) {
                <div class="flex shrink-0 gap-2 pb-0.5">
                  <button
                    type="button"
                    [class]="arrow"
                    [disabled]="!hasPrevious()"
                    [attr.aria-label]="'media.tracker.previous_episode' | translate"
                    (click)="stepped.emit(-1)"
                  >
                    <shelfy-icon name="chevronLeft" size="20" />
                  </button>
                  <button
                    type="button"
                    [class]="arrow"
                    [disabled]="!hasNext()"
                    [attr.aria-label]="'media.tracker.next_episode' | translate"
                    (click)="stepped.emit(1)"
                  >
                    <shelfy-icon name="chevronRight" size="20" />
                  </button>
                </div>
              }
            </div>
            @if (ep.tmdb || ep.community) {
              <p class="text-text-muted mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.9375rem]">
                @if (ep.tmdb; as tmdb) {
                  <span class="inline-flex items-center gap-1.5">
                    <shelfy-icon
                      name="star"
                      size="15"
                      [active]="true"
                      [style.color]="heat(tmdb.average)"
                    />
                    <b class="text-text font-bold tabular-nums">{{ format(tmdb.average) }}</b>
                    TMDB
                    <span class="text-text-subtle tabular-nums">{{
                      'media.votes_count' | translate: { count: tmdb.votes }
                    }}</span>
                  </span>
                }
                @if (ep.community; as community) {
                  <span class="inline-flex items-center gap-1.5">
                    <shelfy-icon
                      name="star"
                      size="15"
                      [active]="true"
                      [style.color]="heat(community.average)"
                    />
                    <b class="text-text font-bold tabular-nums">{{ format(community.average) }}</b>
                    {{ 'media.tracker.source.community' | translate }}
                    <span class="text-text-subtle tabular-nums">{{
                      'media.votes_count' | translate: { count: community.votes }
                    }}</span>
                  </span>
                }
              </p>
            }
          </header>

          <div
            class="flex flex-col gap-8 px-5 pt-7 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:px-6.5 sm:pt-8 sm:pb-10"
          >
            @if (!ep.released) {
              <p class="text-text-subtle text-base">{{ 'media.tracker.not_aired' | translate }}</p>
            } @else if (editable()) {
              <section
                class="animate-rise-in flex flex-col gap-7 sm:gap-8"
                [attr.aria-label]="'media.your_rating' | translate"
              >
                <shelfy-rating-block
                  class="max-sm:order-last"
                  [value]="ep.mine"
                  (changed)="rated.emit($event)"
                />
                <div class="v-sh-status" style="grid-template-columns: minmax(0, 1fr)">
                  <button
                    type="button"
                    role="switch"
                    data-autofocus
                    [style.--s]="doneColor"
                    [attr.aria-checked]="ep.watched"
                    (click)="watchedToggled.emit(!ep.watched)"
                  >
                    <shelfy-icon name="checkCircle" [active]="ep.watched" size="28" />
                    <span class="lbl">{{
                      (ep.watched ? 'media.tracker.watched' : 'media.tracker.mark_watched')
                        | translate
                    }}</span>
                  </button>
                </div>
              </section>
            } @else {
              <div class="flex flex-col items-start gap-4">
                <p class="text-text-muted text-base">
                  {{ 'media.tracker.add_to_rate' | translate: { title: showTitle() } }}
                </p>
                <button type="button" [class]="primary" (click)="addRequested.emit()">
                  <shelfy-icon name="bookmarks" size="20" />
                  {{ 'collection.backlog.add' | translate }}
                </button>
              </div>
            }

            @if (ep.overview) {
              <p class="text-text-muted text-base leading-relaxed text-pretty">
                {{ ep.overview }}
              </p>
            }

            @if (ep.friends.length > 0) {
              <section aria-labelledby="episode-friends-title">
                <h3
                  id="episode-friends-title"
                  class="font-display text-text text-xl leading-none font-extrabold tracking-[-0.03em]"
                >
                  {{ 'media.tracker.friends' | translate }}
                </h3>
                <ul class="mt-3 flex flex-col">
                  @for (friend of ep.friends; track friend.username) {
                    <li>
                      <a
                        [routerLink]="['/profile', friend.username]"
                        class="-mx-2 flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-white/6"
                      >
                        <shelfy-avatar
                          size="40"
                          [displayName]="friend.displayName || friend.username"
                          [avatarUrl]="friend.avatarUrl"
                        />
                        <span class="text-text min-w-0 flex-1 truncate text-base font-semibold">{{
                          friend.displayName || friend.username
                        }}</span>
                        <shelfy-rating-ring [rating]="friend.rating" />
                      </a>
                    </li>
                  }
                </ul>
              </section>
            }
          </div>
        </div>
      </aside>
    </div>
  `,
})
export class EpisodeSheetComponent {
  private readonly tmdb = inject(TmdbService);
  private readonly translate = inject(TranslateService);
  private readonly dateFormat = inject(DateFormatService);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly returnFocus = document.activeElement as HTMLElement | null;

  readonly cell = input.required<EpisodeCell>();
  readonly editable = input(false);
  readonly showTitle = input('');
  readonly hasPrevious = input(false);
  readonly hasNext = input(false);
  readonly addRequested = output<void>();
  readonly watchedToggled = output<boolean>();
  readonly rated = output<number | null>();
  readonly stepped = output<-1 | 1>();
  readonly closed = output<void>();

  protected readonly recipes = SHEET_RECIPES;
  protected readonly handleClass = SHEET_RECIPES.handle.replace(' sm:hidden', '');
  protected readonly dragSettle = 'translate var(--duration-base) var(--ease-drawer)';
  protected readonly drag = new SheetDrag(
    () => this.panel()?.nativeElement.offsetHeight ?? 0,
    (dismiss) => {
      if (dismiss) this.requestClose();
    },
  );
  readonly closing = signal(false);
  private closeFallback: ReturnType<typeof setTimeout> | null = null;

  readonly primary = buttonClasses({ variant: 'primary' });
  readonly doneColor = collectionStatusColor('done');
  readonly format = formatRating;
  readonly heat = heatColor;
  readonly arrow = SEASON_ARROW;

  readonly code = computed(() => `S${this.cell().season} · E${this.cell().episode}`);

  constructor() {
    afterNextRender(() => {
      const panel = this.panel()?.nativeElement;
      const target =
        panel?.querySelector<HTMLElement>('[data-autofocus]') ??
        panel?.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus({ preventScroll: true });
    });
  }

  stillUrl(): string | null {
    return this.tmdb.imageUrl(this.cell().stillPath, 'w780');
  }

  facts(): string | null {
    const { airDate, runtime } = this.cell();
    const parts: string[] = [];
    if (airDate) {
      parts.push(
        this.dateFormat.formatDate(new Date(`${airDate}T12:00:00`), this.translate.lang(), 'long'),
      );
    }
    if (runtime) parts.push(`${runtime} min`);
    return parts.length ? parts.join(' · ') : null;
  }

  requestClose(): void {
    if (this.closing()) return;
    this.closing.set(true);
    this.closeFallback = setTimeout(() => this.finishClose(), 400);
  }

  onPanelAnimationEnd(event: AnimationEvent): void {
    if (!this.closing() || event.target !== event.currentTarget) return;
    this.finishClose();
  }

  private finishClose(): void {
    if (!this.closeFallback) return;
    clearTimeout(this.closeFallback);
    this.closeFallback = null;
    this.returnFocus?.focus?.({ preventScroll: true });
    this.closed.emit();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.requestClose();
      return;
    }
    const target = event.target;
    const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    const typing =
      target instanceof Element && !!target.closest('[role="slider"], input, textarea');
    if (step && !typing) {
      if (step === -1 ? this.hasPrevious() : this.hasNext()) {
        event.preventDefault();
        this.stepped.emit(step);
      }
      return;
    }
    const panel = this.panel()?.nativeElement;
    if (panel) trapTab(event, panel);
  }
}
