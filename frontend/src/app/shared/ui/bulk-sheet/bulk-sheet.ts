import { buttonClasses } from '@shared/ui/button/button';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { CollectionService } from '@app/core/services/collection/collection';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import { AmbientService } from '@app/core/services/ambient/ambient';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import type {
  BulkUpdateCollectionItemRequest,
  CollectionItemResponse,
  MediaType,
  UserMediaStatus,
} from '@app/core/services/collection/collection.model';
import { IconComponent } from '@shared/ui/icon/icon';
import { RatingSliderComponent } from '@shared/ui/rating-slider/rating-slider';
import { SHEET_RECIPES, SheetDrag } from '@shared/ui/side-sheet/sheet-drag';
import { FOCUSABLE, trapTab } from '@shared/ui/focus-trap/focus-trap';
import {
  formatRating,
  ratingToTextColor,
  ratingVerdictKey,
} from '@shared/utils/collection-rating.util';
import { StatusPickerComponent } from '../item-sheet/ui/status-picker/status-picker';

const MAX_COVERS = 3;

@Component({
  selector: 'shelfy-bulk-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IconComponent, StatusPickerComponent, RatingSliderComponent],
  templateUrl: './bulk-sheet.html',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class BulkSheetComponent {
  private readonly collectionService = inject(CollectionService);
  private readonly toastService = inject(ToastService);
  private readonly errorMessage = inject(ErrorMessageService);
  private readonly translate = inject(TranslateService);
  private readonly confirm = inject(ConfirmService);
  private readonly ambient = inject(AmbientService);

  items = input.required<CollectionItemResponse[]>();
  statuses = input<UserMediaStatus[]>([]);

  readonly closed = output<void>();
  readonly applied = output<CollectionItemResponse[]>();

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly returnFocus = document.activeElement as HTMLElement | null;

  protected readonly recipes = SHEET_RECIPES;
  protected readonly textAction =
    'text-text-muted hover:text-text inline-flex h-11 cursor-pointer items-center gap-2 text-[0.9375rem] font-semibold transition-colors';
  protected readonly dangerButton = buttonClasses({ variant: 'danger', extraClass: 'min-w-0' });
  protected readonly applyButton = buttonClasses({ variant: 'primary', extraClass: 'min-w-0' });
  protected readonly dragSettle = 'translate var(--duration-base) var(--ease-drawer)';
  protected readonly drag = new SheetDrag(
    () => this.panel()?.nativeElement.offsetHeight ?? 0,
    (dismiss) => {
      if (dismiss) this.requestClose();
    },
  );

  readonly statusDraft = signal<UserMediaStatus | null>(null);
  readonly ratingDraft = signal<number | null>(null);
  readonly ratingTouched = signal(false);
  readonly ratingPreview = signal<number | null>(null);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly closing = signal(false);
  private readonly hidden = signal(false);
  private readonly tint = signal<string | null>(null);
  private closeFallback: ReturnType<typeof setTimeout> | null = null;

  readonly count = computed(() => this.items().length);
  readonly covers = computed(() =>
    this.items()
      .map((item) => item.media.coverUrl)
      .filter((url): url is string => !!url)
      .slice(0, MAX_COVERS),
  );
  readonly top = computed(
    () =>
      `color-mix(in srgb, ${this.tint() ?? 'var(--color-surface-3)'} 34%, var(--color-surface))`,
  );
  readonly typeSummary = computed(() => {
    this.translate.lang();
    const counts = new Map<MediaType, number>();
    for (const item of this.items()) {
      counts.set(item.media.mediaType, (counts.get(item.media.mediaType) ?? 0) + 1);
    }
    return [...counts]
      .map(
        ([type, n]) =>
          `${n} ${this.translate.get(n === 1 ? 'collection.media_type_one.' + type : 'collection.media_type.' + type)}`,
      )
      .join(' · ');
  });

  readonly commonStatus = computed(() => {
    const [first, ...rest] = this.items();
    return first && rest.every((item) => item.status === first.status) ? first.status : null;
  });
  readonly shownStatus = computed(() => this.statusDraft() ?? this.commonStatus());
  readonly statusDetail = computed(() =>
    this.statusDraft() === null && this.commonStatus()
      ? this.translate.get('library.bulk.of_total', { count: this.count(), total: this.count() })
      : null,
  );

  readonly commonRating = computed(() => {
    const [first, ...rest] = this.items();
    return first && rest.every((item) => item.rating === first.rating) ? first.rating : undefined;
  });
  readonly mixedRatings = computed(
    () => !this.ratingTouched() && this.commonRating() === undefined,
  );
  readonly shownRating = computed(() => {
    const preview = this.ratingPreview();
    if (preview !== null) return preview;
    if (this.ratingTouched()) return this.ratingDraft();
    return this.commonRating() ?? null;
  });
  readonly ratingLabel = computed(() =>
    this.mixedRatings() && this.ratingPreview() === null
      ? 'library.bulk.mixed'
      : ratingVerdictKey(this.shownRating()),
  );
  readonly ratingNumber = computed(() => {
    const rating = this.shownRating();
    if (rating === null || (this.mixedRatings() && this.ratingPreview() === null)) {
      return { text: '–', color: 'var(--color-text-subtle)' };
    }
    return { text: formatRating(rating), color: ratingToTextColor(rating, 55) };
  });

  readonly hasChanges = computed(() => this.statusDraft() !== null || this.ratingTouched());
  readonly panelMotion = computed(() =>
    this.closing()
      ? 'max-sm:animate-sheet-out sm:animate-drawer-out'
      : 'max-sm:animate-sheet-in sm:animate-drawer-in',
  );
  readonly isHidden = this.hidden.asReadonly();

  constructor() {
    effect(() => {
      const cover = this.covers()[0];
      if (!cover) return;
      void this.ambient.colorOf(cover).then((color) => this.tint.set(color));
    });
    afterNextRender(() => {
      const panel = this.panel()?.nativeElement;
      const target =
        panel?.querySelector<HTMLElement>('[data-autofocus]') ??
        panel?.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus({ preventScroll: true });
    });
  }

  pickStatus(status: UserMediaStatus): void {
    this.statusDraft.set(this.statusDraft() === status ? null : status);
  }

  onRatingChange(rating: number | null): void {
    this.ratingTouched.set(true);
    this.ratingDraft.set(rating);
  }

  clearRatings(): void {
    this.onRatingChange(null);
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
    this.returnFocus?.focus?.();
    this.closed.emit();
  }

  apply(): void {
    if (!this.hasChanges() || this.saving()) return;
    const request: BulkUpdateCollectionItemRequest = { ids: this.items().map((item) => item.id) };
    const status = this.statusDraft();
    if (status !== null) request.status = status;
    if (this.ratingTouched()) {
      const rating = this.ratingDraft();
      if (rating === null) request.clearRating = true;
      else request.rating = rating;
    }
    this.saving.set(true);
    this.collectionService.bulkUpdate(request).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.applied.emit(updated);
        this.requestClose();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        catchAndToastError(this.toastService, this.errorMessage)(error);
      },
    });
  }

  async deleteAll(): Promise<void> {
    const ids = this.items().map((item) => item.id);
    this.hidden.set(true);
    const confirmed = await this.confirm.ask(
      this.translate.get('collection.bulk.delete_confirm_message'),
      {
        title: this.translate.get('collection.bulk.delete_confirm_title', { count: ids.length }),
        confirmLabel: this.translate.get('collection.bulk.delete'),
        cancelLabel: this.translate.get('collection.cancel'),
        destructive: true,
      },
    );
    this.hidden.set(false);
    if (!confirmed) return;
    this.deleting.set(true);
    this.collectionService.bulkRemove(ids).subscribe({
      next: () => {
        this.deleting.set(false);
        this.toastService.success(
          this.translate.get('collection.bulk.deleted', { count: ids.length }),
        );
        this.requestClose();
      },
      error: (error: unknown) => {
        this.deleting.set(false);
        catchAndToastError(this.toastService, this.errorMessage)(error);
      },
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.hidden()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.requestClose();
      return;
    }
    const panel = this.panel()?.nativeElement;
    if (panel) trapTab(event, panel);
  }
}
