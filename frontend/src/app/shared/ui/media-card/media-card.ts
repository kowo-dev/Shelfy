import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { AddSheetService } from '@app/core/services/add-sheet/add-sheet';
import { AdultGateService } from '@app/core/services/adult-gate/adult-gate';
import { ItemSheetService } from '@app/core/services/item-sheet/item-sheet';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { ShelfLookupService } from '@app/core/services/shelf-lookup/shelf-lookup';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { AdultBadgeComponent } from '@shared/ui/adult-badge/adult-badge';
import { IconComponent } from '@shared/ui/icon/icon';
import { buildAddTarget } from '@shared/utils/add-target.util';
import { formatRating, ratingToTextColor } from '@shared/utils/collection-rating.util';
import { formatGap, ratingGap } from '@shared/utils/rating-gap.util';
import { collectionStatusColor, statusLabelKey } from '@shared/utils/collection-status.util';
import { imageRendition } from '@shared/utils/image-rendition.util';

const LONG_PRESS_MS = 450;

@Component({
  selector: 'shelfy-media-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IconComponent, AdultBadgeComponent],
  template: `
    @let view = card();
    @if (masked()) {
      <button
        type="button"
        class="poster w-full"
        [attr.aria-label]="'adult.hidden' | translate"
        (click)="openAdultGate()"
      >
        <span class="cover text-text-muted grid place-items-center">
          <shelfy-adult-badge size="4rem" />
        </span>
      </button>
    } @else {
      <article
        class="poster group/card"
        tabindex="0"
        [class.is-selected]="selectionMode() && selected()"
        [class.animate-pop-out]="exiting()"
        [class.pointer-events-none]="exiting()"
        [attr.role]="selectionMode() ? 'checkbox' : null"
        [attr.aria-checked]="selectionMode() ? selected() : null"
        [attr.aria-label]="view.title"
        (click)="activate($event)"
        (keydown.enter)="activate($event)"
        (pointerdown)="onPressStart($event)"
        (pointerup)="cancelPress()"
        (pointercancel)="cancelPress()"
        (pointermove)="cancelPress()"
        (contextmenu)="onContextMenu($event)"
        (animationend)="onAnimationEnd($event)"
      >
        <span class="cover">
          @if (view.cover && brokenCover() !== view.cover) {
            <img
              [src]="view.cover"
              alt=""
              loading="lazy"
              draggable="false"
              (error)="brokenCover.set(view.cover)"
            />
          } @else {
            <span class="cover-empty" aria-hidden="true"
              ><shelfy-icon name="noImage" size="32"
            /></span>
          }
          <ng-content select="[cardOverlay]" />
          @if (selectionMode()) {
            <span class="cover-check" [class.is-on]="selected()" aria-hidden="true">
              <shelfy-icon name="check" size="16" />
            </span>
          } @else {
            @if (selectable()) {
              <button
                type="button"
                class="cover-check cover-select"
                [attr.aria-label]="'collection.bulk.select_item' | translate: { title: view.title }"
                (click)="$event.stopPropagation(); selectionToggle.emit()"
              >
                <shelfy-icon name="check" size="16" />
              </button>
            }
            @if (mine()) {
              <button
                type="button"
                class="cover-add"
                [attr.aria-label]="('collection.edit' | translate) + ' · ' + view.title"
                (click)="$event.stopPropagation(); itemSheet.open(item())"
              >
                <shelfy-icon name="edit" size="19" />
              </button>
            } @else if (addable()) {
              @if (owned(); as shelf) {
                <button
                  type="button"
                  class="cover-add is-done"
                  [attr.aria-label]="('collection.edit' | translate) + ' · ' + shelf.media.title"
                  (click)="$event.stopPropagation(); itemSheet.open(shelf)"
                >
                  <shelfy-icon name="check" size="20" />
                </button>
              } @else {
                <button
                  type="button"
                  class="cover-add"
                  [attr.aria-label]="('collection.backlog.add' | translate) + ' · ' + view.title"
                  (click)="$event.stopPropagation(); shelve()"
                >
                  <shelfy-icon name="plus" size="20" />
                </button>
              }
            }
          }
        </span>
        @if (rank(); as value) {
          <div class="ranked-caption">
            <span class="ranked-caption-rank" [class.is-top]="value <= 3">{{ value }}</span>
            <div>
              <span class="caption">
                <b>{{ view.title }}</b>
                @if (view.rating; as rating) {
                  <span class="score"
                    ><shelfy-icon name="star" size="14" [active]="true" />{{ rating }}</span
                  >
                }
              </span>
              <span class="caption-sub">{{ subtitle() ?? view.meta }}</span>
            </div>
          </div>
        } @else {
          <span class="caption">
            <b>{{ view.title }}</b>
            @if (view.rating; as rating) {
              <span class="score" [style.color]="tinted() || mine() ? view.color : null"
                ><shelfy-icon name="star" size="14" [active]="true" />{{ rating }}</span
              >
            }
          </span>
          @if (versusView(); as other) {
            <span class="caption-sub status-line">
              {{ 'friends.shelf.you' | translate }}
              @if (other.rating) {
                <span class="score" [style.color]="other.color"
                  ><shelfy-icon name="star" size="13" [active]="true" />{{ other.rating }}</span
                >
              } @else {
                <span class="status-dot" [style.--s]="other.dot"></span>
                {{ other.statusKey | translate }}
              }
            </span>
            @if (other.verdictKey; as key) {
              <span class="caption-sub rating-gap">
                {{ key | translate }}
                @if (other.delta; as delta) {
                  · <span class="tabular-nums">{{ delta }}</span>
                }
              </span>
            }
          } @else if (subtitle(); as text) {
            <span class="caption-sub">{{ text }}</span>
          } @else if (mine() || status()) {
            <span class="caption-sub status-line">
              <span class="status-dot" [style.--s]="statusColor()"></span>
              {{ statusKey() | translate }} · {{ view.type }}
            </span>
          } @else {
            <span class="caption-sub">{{ view.type }}</span>
          }
        }
      </article>
    }
  `,
  host: { class: 'block min-w-0' },
})
export class MediaCardComponent {
  private readonly lookup = inject(ShelfLookupService);
  private readonly addSheet = inject(AddSheetService);
  private readonly adultGate = inject(AdultGateService);
  protected readonly itemSheet = inject(ItemSheetService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  item = input.required<CollectionItemResponse>();
  subtitle = input<string | null>(null);
  versus = input<CollectionItemResponse | null>(null);
  status = input(false);
  protected readonly brokenCover = signal<string | null>(null);
  rank = input<number | null>(null);
  addable = input(true);
  tinted = input(false);
  mine = input(false);
  selectable = input(false);
  selectionMode = input(false);
  selected = input(false);
  exiting = input(false);
  readonly selectionToggle = output<void>();
  readonly exited = output<void>();

  readonly masked = computed(() => !!this.item().media.isAdult && !this.item().media.title);
  readonly owned = computed(() =>
    this.mine() ? this.item() : this.lookup.find(this.item().media),
  );
  readonly statusKey = computed(() =>
    statusLabelKey(this.item().status, this.item().media.mediaType),
  );
  readonly statusColor = computed(() => collectionStatusColor(this.item().status));

  readonly versusView = computed(() => {
    const other = this.versus();
    if (!other) return null;
    const theirs = this.item().rating;
    const gap = ratingGap(theirs, other.rating);
    const verdict =
      gap?.kind ?? (other.rating ? 'unrated_by_them' : theirs ? 'rate_to_compare' : null);
    return {
      rating: other.rating ? formatRating(other.rating) : null,
      color: other.rating ? ratingToTextColor(other.rating, 100) : null,
      dot: collectionStatusColor(other.status),
      statusKey: statusLabelKey(other.status, other.media.mediaType),
      verdictKey: verdict ? 'friends.shelf.gap.' + verdict : null,
      delta: gap && gap.delta !== 0 ? formatGap(gap.delta) : null,
    };
  });

  readonly card = computed(() => {
    this.translate.lang();
    const { media, rating, userId } = this.item();
    const date = media.metadata?.['releaseDate'];
    const year = typeof date === 'string' && /^\d{4}/.test(date) ? date.slice(0, 4) : null;
    const type = this.translate.get('collection.media_type_one.' + media.mediaType);
    return {
      title: media.title,
      cover: media.coverUrl ? imageRendition(media.coverUrl, 'card') : null,
      rating: rating ? formatRating(rating) : null,
      color: !rating || !userId ? null : ratingToTextColor(rating, 100),
      type,
      meta: [type, year].filter(Boolean).join(' · '),
    };
  });

  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  private pressed = false;

  constructor() {
    effect(() => {
      if (!this.mine() && this.addable()) this.lookup.request(this.item().media);
    });
  }

  activate(event: Event): void {
    const target = event.target as Element;
    if (target !== event.currentTarget && target.closest('button, a')) return;
    if (this.pressed) {
      this.pressed = false;
      return;
    }
    if (this.selectionMode()) this.selectionToggle.emit();
    else if (this.mine()) this.itemSheet.open(this.item());
    else this.open();
  }

  open(): void {
    const { media } = this.item();
    void this.router.navigate(['/media', media.mediaType, media.externalId]);
  }

  openAdultGate(): void {
    void this.adultGate.open();
  }

  shelve(): void {
    const item = this.item();
    this.addSheet.open(
      buildAddTarget(item, this.translate.get('collection.media_type_one.' + item.media.mediaType)),
    );
  }

  onPressStart(event: PointerEvent): void {
    if (!this.selectable() || event.pointerType === 'mouse') return;
    this.pressed = false;
    this.cancelPress();
    this.pressTimer = setTimeout(() => {
      this.pressed = true;
      navigator.vibrate?.(8);
      this.selectionToggle.emit();
    }, LONG_PRESS_MS);
  }

  cancelPress(): void {
    if (this.pressTimer) clearTimeout(this.pressTimer);
    this.pressTimer = null;
  }

  onContextMenu(event: MouseEvent): void {
    if (this.selectable() && (event as PointerEvent).pointerType !== 'mouse')
      event.preventDefault();
  }

  onAnimationEnd(event: AnimationEvent): void {
    if (event.target === event.currentTarget && this.exiting()) this.exited.emit();
  }
}
