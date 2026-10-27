import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import {
  type MediaType,
  type UserMediaStatus,
} from '@app/core/services/collection/collection.model';
import { IconComponent } from '@shared/ui/icon/icon';
import {
  FILTER_GROUP_TITLE,
  FILTER_TILE,
  FILTER_TILE_OFF,
  FILTER_TILE_ON,
} from '@shared/ui/ui-recipes';
import type { RatingBound } from '@shared/utils/collection-filter.types';
import { collectionStatusColor } from '@shared/utils/collection-status.util';
import { MEDIA_TYPE_ICON } from '@shared/utils/media-type-icon.util';

const STATUS_ORDER: readonly UserMediaStatus[] = ['ongoing', 'planned', 'done', 'dropped'];
const MEDIA_ORDER: readonly MediaType[] = ['movie', 'tv_show', 'game', 'anime', 'manga', 'webtoon'];
const RATING_MINS: readonly { value: number; label: string }[] = [
  { value: 4, label: '2+' },
  { value: 6, label: '3+' },
  { value: 8, label: '4+' },
  { value: 9, label: '4.5+' },
];

@Component({
  selector: 'shelfy-library-filters',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IconComponent],
  template: `
    <ng-content />
    @if (showStatus()) {
      <div role="group" [attr.aria-label]="'library.status' | translate">
        <p [class]="groupTitle">{{ 'library.status' | translate }}</p>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            [class]="tile(statuses().length === 0)"
            [attr.aria-pressed]="statuses().length === 0"
            (click)="statusesChange.emit([])"
          >
            {{ 'library.all' | translate }}
            <span class="tabular-nums opacity-55">{{ total() ?? '' }}</span>
          </button>
          @for (status of statusOrder; track status) {
            @let on = statuses().includes(status);
            <button
              type="button"
              [class]="tile(on)"
              [attr.aria-pressed]="on"
              (click)="toggleStatus(status)"
            >
              {{ 'collection.status.' + status | translate }}
              <span class="tabular-nums opacity-55">{{ statusCounts()?.[status] ?? '' }}</span>
            </button>
          }
        </div>
      </div>
    }

    @if (showMedia()) {
      <div role="group" [attr.aria-label]="'library.media' | translate">
        <p [class]="groupTitle">{{ 'library.media' | translate }}</p>
        <div class="flex flex-wrap gap-2">
          @for (type of mediaOrder; track type) {
            @let on = mediaTypes().includes(type);
            <button
              type="button"
              [class]="tile(on)"
              [attr.aria-pressed]="on"
              (click)="toggleType(type)"
            >
              {{ 'collection.media_type.' + type | translate }}
              <span class="tabular-nums opacity-55">{{ mediaCounts()?.[type] ?? '' }}</span>
            </button>
          }
        </div>
      </div>
    }

    <ng-content select="[afterMedia]" />

    <div role="group" [attr.aria-label]="ratingLabel() | translate">
      <p [class]="groupTitle">{{ ratingLabel() | translate }}</p>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          [class]="tile(ratingMin() === 1 && ratingTo() === 10)"
          [attr.aria-pressed]="ratingMin() === 1 && ratingTo() === 10"
          (click)="ratingRangeChange.emit({ from: 1, to: 10 })"
        >
          {{ 'library.rating_any' | translate }}
        </button>
        @for (min of ratingMins; track min.value) {
          @let on = ratingMin() === min.value && ratingTo() === 10;
          <button
            type="button"
            [class]="tile(on)"
            [attr.aria-pressed]="on"
            (click)="ratingRangeChange.emit({ from: min.value, to: 10 })"
          >
            <shelfy-icon name="star" size="14" [active]="true" />{{ min.label }}
          </button>
        }
      </div>
    </div>

    <div role="group" [attr.aria-label]="'library.show' | translate">
      <p [class]="groupTitle">{{ 'library.show' | translate }}</p>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          [class]="tile(unratedIncluded())"
          [attr.aria-pressed]="unratedIncluded()"
          (click)="includeUnratedChange.emit(!unratedIncluded())"
        >
          {{ 'library.include_unrated' | translate }}
        </button>
        <button
          type="button"
          [class]="tile(hasNote())"
          [attr.aria-pressed]="hasNote()"
          (click)="hasNoteChange.emit(!hasNote())"
        >
          {{ 'library.with_review' | translate }}
        </button>
      </div>
    </div>
  `,
  host: { class: 'flex flex-col gap-7' },
})
export class LibraryFiltersComponent {
  showStatus = input(true);
  showMedia = input(true);
  statuses = input<UserMediaStatus[]>([]);
  statusCounts = input<Partial<Record<UserMediaStatus, number>> | null>(null);
  total = input<number | null>(null);
  mediaTypes = input<MediaType[]>([]);
  mediaCounts = input<Partial<Record<MediaType, number>> | null>(null);
  mediaTotal = input<number | null>(null);
  ratingFrom = input<RatingBound>('unrated');
  ratingTo = input(10);
  includeUnrated = input(false);
  hasNote = input(false);
  ratingLabel = input('library.your_rating');

  readonly statusesChange = output<UserMediaStatus[]>();
  readonly mediaTypesChange = output<MediaType[]>();
  readonly ratingRangeChange = output<{ from: number; to: number }>();
  readonly includeUnratedChange = output<boolean>();
  readonly hasNoteChange = output<boolean>();

  protected readonly statusOrder = STATUS_ORDER;
  protected readonly mediaOrder = MEDIA_ORDER;
  protected readonly ratingMins = RATING_MINS;

  readonly ratingMin = computed(() => {
    const from = this.ratingFrom();
    return from === 'unrated' ? 1 : from;
  });
  readonly unratedIncluded = computed(
    () => this.ratingFrom() === 'unrated' || this.includeUnrated(),
  );

  protected readonly groupTitle = FILTER_GROUP_TITLE;

  tile(on: boolean): string {
    return FILTER_TILE + ' ' + (on ? FILTER_TILE_ON : FILTER_TILE_OFF);
  }

  statusColor(status: UserMediaStatus): string {
    return collectionStatusColor(status);
  }

  typeIcon(type: MediaType): string {
    return MEDIA_TYPE_ICON[type];
  }

  toggleStatus(status: UserMediaStatus): void {
    const current = this.statuses();
    const next = current.includes(status)
      ? current.filter((value) => value !== status)
      : STATUS_ORDER.filter((value) => value === status || current.includes(value));
    this.statusesChange.emit(next.length === STATUS_ORDER.length ? [] : next);
  }

  toggleType(type: MediaType): void {
    const current = this.mediaTypes();
    const next = current.includes(type)
      ? current.filter((value) => value !== type)
      : MEDIA_ORDER.filter((value) => value === type || current.includes(value));
    this.mediaTypesChange.emit(next.length === MEDIA_ORDER.length ? [] : next);
  }
}
