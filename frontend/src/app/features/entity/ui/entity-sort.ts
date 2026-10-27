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
import { IconComponent } from '@shared/ui/icon/icon';
import { TranslateService } from '@app/core/services/translate/translate';
import { SegmentedComponent } from '@shared/ui/segmented/segmented';
import { FILTER_GROUP_TITLE, TOOLBAR_BUTTON } from '@shared/ui/ui-recipes';

export type EntitySortDirection = 'asc' | 'desc';

export interface EntitySortOption {
  id: string;
  label: string;
  natural: EntitySortDirection;
}

@Component({
  selector: 'shelfy-entity-sort',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IconComponent, SegmentedComponent],
  template: `
    <button
      type="button"
      [class]="button"
      aria-haspopup="true"
      [attr.aria-expanded]="open()"
      (click)="open.set(!open())"
    >
      <shelfy-icon name="sortNeutral" size="18" class="text-text-muted" />
      <span class="truncate"
        >{{ current()?.label
        }}<span class="max-md:hidden">
          · {{ 'entity.direction.' + sort() + '.' + direction() | translate }}</span
        ></span
      >
      <shelfy-icon name="chevronDown" size="16" class="text-text-subtle" />
    </button>
    @if (open()) {
      <div
        class="bg-surface-2 shadow-pop animate-pop-in rounded-popover absolute top-[calc(100%+8px)] right-0 z-30 w-max max-w-[calc(100vw-2rem)] origin-top-right p-4.5"
      >
        <p [class]="groupTitle">
          {{ 'library.sort_by' | translate }}
        </p>
        <shelfy-segmented
          [options]="sortOptions()"
          [value]="sort()"
          [label]="'library.sort_by' | translate"
          (changed)="pick($event)"
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
    class: 'relative block min-w-0',
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
})
export class EntitySortComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly options = input.required<readonly EntitySortOption[]>();
  readonly sort = input.required<string>();
  readonly direction = input.required<EntitySortDirection>();
  readonly sortChange = output<string>();
  readonly directionChange = output<EntitySortDirection>();

  protected readonly button = TOOLBAR_BUTTON + ' max-w-full';
  protected readonly groupTitle = FILTER_GROUP_TITLE;
  readonly open = signal(false);

  readonly current = computed(() => this.options().find((option) => option.id === this.sort()));
  readonly directions = computed<EntitySortDirection[]>(() =>
    this.current()?.natural === 'asc' ? ['asc', 'desc'] : ['desc', 'asc'],
  );
  private readonly translate = inject(TranslateService);
  readonly directionOptions = computed(() => {
    this.translate.lang();
    return this.directions().map((dir) => ({
      id: dir,
      label: this.translate.get('entity.direction.' + this.sort() + '.' + dir),
    }));
  });

  readonly sortOptions = computed(() => this.options().map(({ id, label }) => ({ id, label })));

  pick(id: string): void {
    const option = this.options().find((candidate) => candidate.id === id);
    if (!option || id === this.sort()) return;
    this.sortChange.emit(option.id);
    this.directionChange.emit(option.natural);
  }

  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}
