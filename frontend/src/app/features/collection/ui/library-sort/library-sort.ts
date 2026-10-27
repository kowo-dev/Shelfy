import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import type {
  CollectionSortBy,
  CollectionSortDirection,
} from '@app/core/services/collection/collection.model';
import { IconComponent } from '@shared/ui/icon/icon';
import { TranslateService } from '@app/core/services/translate/translate';
import { SegmentedComponent } from '@shared/ui/segmented/segmented';
import { FILTER_GROUP_TITLE, TOOLBAR_BUTTON } from '@shared/ui/ui-recipes';

export const LIBRARY_SORTS: readonly { field: CollectionSortBy; dir: CollectionSortDirection }[] = [
  { field: 'addedAt', dir: 'desc' },
  { field: 'updatedAt', dir: 'desc' },
  { field: 'title', dir: 'asc' },
  { field: 'rating', dir: 'desc' },
];

@Component({
  selector: 'shelfy-library-sort',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IconComponent, SegmentedComponent],
  template: `
    @if (!inline()) {
      <button
        type="button"
        [class]="button"
        aria-haspopup="true"
        [attr.aria-expanded]="open()"
        (click)="open.set(!open())"
      >
        <shelfy-icon name="sortNeutral" size="18" class="text-text-muted" />
        {{ sortLabel(sortBy()) | translate }} ·
        {{ 'library.direction.' + sortBy() + '.' + direction() | translate }}
        <shelfy-icon name="chevronDown" size="16" class="text-text-subtle" />
      </button>
    }
    @if (open() || inline()) {
      <div
        [class]="
          inline()
            ? ''
            : 'bg-surface-2 shadow-pop animate-pop-in rounded-popover absolute top-[calc(100%+8px)] right-0 z-30 w-max max-w-[calc(100vw-2rem)] origin-top-right p-4.5'
        "
      >
        <p [class]="groupTitle">{{ 'library.sort_by' | translate }}</p>
        <shelfy-segmented
          [options]="sortOptions()"
          [value]="sortBy()"
          [label]="'library.sort_by' | translate"
          (changed)="pickField($event)"
        />
        <p [class]="groupTitle + ' mt-5'">{{ 'library.direction_label' | translate }}</p>
        <shelfy-segmented
          [options]="directionOptions()"
          [value]="direction()"
          [label]="'library.direction_label' | translate"
          (changed)="directionChange.emit($any($event))"
        />
      </div>
    }
  `,
  host: {
    class: 'relative block',
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
})
export class LibrarySortComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  inline = input(false);
  sortBy = input<CollectionSortBy>('addedAt');
  sortDirection = input<CollectionSortDirection | null>(null);
  ratingLabel = input('library.sort.rating');

  readonly sortByChange = output<CollectionSortBy>();
  readonly directionChange = output<CollectionSortDirection>();

  private readonly translate = inject(TranslateService);
  protected readonly button = TOOLBAR_BUTTON;
  protected readonly groupTitle = FILTER_GROUP_TITLE;
  readonly open = signal(false);

  readonly direction = computed<CollectionSortDirection>(
    () =>
      this.sortDirection() ??
      LIBRARY_SORTS.find((sort) => sort.field === this.sortBy())?.dir ??
      'desc',
  );

  readonly directions = computed<CollectionSortDirection[]>(() => {
    const natural = LIBRARY_SORTS.find((sort) => sort.field === this.sortBy())?.dir ?? 'desc';
    return natural === 'desc' ? ['desc', 'asc'] : ['asc', 'desc'];
  });

  readonly directionOptions = computed(() => {
    this.translate.lang();
    return this.directions().map((dir) => ({
      id: dir,
      label: this.translate.get('library.direction.' + this.sortBy() + '.' + dir),
    }));
  });

  readonly sortOptions = computed(() => {
    this.translate.lang();
    return LIBRARY_SORTS.map(({ field }) => ({
      id: field,
      label: this.translate.get(this.sortLabel(field)),
    }));
  });

  pickField(id: string): void {
    const sort = LIBRARY_SORTS.find(({ field }) => field === id);
    if (sort) this.pick(sort.field, sort.dir);
  }

  sortLabel(field: CollectionSortBy): string {
    return field === 'rating' ? this.ratingLabel() : 'library.sort.' + field;
  }

  pick(field: CollectionSortBy, dir: CollectionSortDirection): void {
    if (field === this.sortBy()) return;
    this.sortByChange.emit(field);
    this.directionChange.emit(dir);
  }

  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}
