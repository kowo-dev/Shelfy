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
import { catchError, EMPTY, finalize, of, shareReplay, tap, type Observable } from 'rxjs';
import { Router } from '@angular/router';
import { IconComponent } from '@shared/ui/icon/icon';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { TranslateService } from '@app/core/services/translate/translate';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { CollectionService } from '@app/core/services/collection/collection';
import { SHEET_RECIPES, SheetDrag } from '@shared/ui/side-sheet/sheet-drag';
import { AmbientService } from '@app/core/services/ambient/ambient';
import { imageRendition } from '@shared/utils/image-rendition.util';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { createHomeArt } from '@app/features/discover/data-access/home-art';
import type {
  CollectionItemResponse,
  UpdateCollectionItemRequest,
  UserMediaStatus,
} from '@app/core/services/collection/collection.model';
import { statusAfterRating } from '@shared/utils/rating-status.util';
import { ItemEditorComponent } from '@shared/ui/item-editor/item-editor';
import { buttonClasses } from '@shared/ui/button/button';
import { FOCUSABLE, trapTab } from '@shared/ui/focus-trap/focus-trap';

const SAVED_FLASH_MS = 1600;

import { ConfirmService } from '@app/core/services/confirm/confirm';

@Component({
  selector: 'shelfy-item-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TranslatePipe, ItemEditorComponent],
  templateUrl: './item-sheet.html',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class ItemSheetComponent {
  private readonly router = inject(Router);
  private readonly collectionService = inject(CollectionService);
  private readonly toastService = inject(ToastService);
  private readonly errorMessage = inject(ErrorMessageService);
  private readonly translate = inject(TranslateService);
  private readonly dateFormat = inject(DateFormatService);
  private readonly confirm = inject(ConfirmService);
  private readonly ambient = inject(AmbientService);

  item = input.required<CollectionItemResponse>();
  draft = input(false);
  autoCreate = input(false);

  readonly closed = output<void>();
  readonly updated = output<CollectionItemResponse>();
  readonly created = output<CollectionItemResponse>();

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly returnFocus = document.activeElement as HTMLElement | null;

  readonly current = signal<CollectionItemResponse | null>(null);
  private readonly createdLocally = signal(false);
  readonly isDraft = computed(() => this.draft() && !this.createdLocally());
  readonly closing = signal(false);
  private readonly suspended = signal(false);
  readonly hidden = this.suspended.asReadonly();
  protected readonly recipes = SHEET_RECIPES;
  protected readonly handleClass = SHEET_RECIPES.handle.replace(' sm:hidden', '');
  protected readonly drag = new SheetDrag(
    () => this.panel()?.nativeElement.offsetHeight ?? 0,
    (dismiss) => {
      if (dismiss) this.requestClose();
    },
  );
  readonly cascade = signal(true);
  private closeFallback: ReturnType<typeof setTimeout> | null = null;
  readonly rise = 'animate-rise-in';
  readonly panelMotion = computed(() =>
    this.closing() ? 'animate-sheet-out' : 'animate-sheet-in',
  );
  protected readonly dragSettle = 'translate var(--duration-base) var(--ease-drawer)';
  readonly saving = signal(0);
  readonly justSaved = signal(false);
  private savedTimer: ReturnType<typeof setTimeout> | null = null;
  readonly saveState = computed(() =>
    this.saving() > 0 ? 'saving' : this.justSaved() ? 'saved' : null,
  );
  readonly deleting = signal(false);

  readonly data = computed(() => this.current() ?? this.item());
  private readonly resolveArt = createHomeArt({
    tmdb: inject(TmdbService),
    igdb: inject(IgdbService),
    brightness: (url) => this.ambient.brightnessOf(url),
  });
  private readonly resolvedArt = signal<string | null>(null);
  readonly artwork = computed(() => {
    const backdrop = this.data().media.metadata?.['backdropUrl'];
    return typeof backdrop === 'string' && backdrop ? backdrop : this.resolvedArt();
  });
  readonly artLoaded = signal(false);
  protected readonly hiRes = imageRendition;
  private readonly tint = signal<string | null>(null);
  readonly top = computed(
    () =>
      `color-mix(in srgb, ${this.tint() ?? 'var(--color-surface-3)'} 34%, var(--color-surface))`,
  );
  readonly addedAgo = computed(() =>
    this.dateFormat.formatRelative(new Date(this.data().createdAt), this.translate.lang()),
  );
  readonly inBacklog = computed(() => !this.isDraft() && this.data().status === 'planned');
  protected readonly actionButton = buttonClasses({
    variant: 'secondary',
    size: 'sm',
    extraClass: 'max-sm:w-11 max-sm:px-0',
  });
  protected readonly removeButton = buttonClasses({
    variant: 'danger',
    size: 'sm',
    iconOnly: true,
  });
  readonly removeLabel = computed(() =>
    this.inBacklog() ? 'collection.sheet.remove_backlog' : 'collection.sheet.remove',
  );
  constructor() {
    effect(() => {
      this.current.set(this.item());
    });
    effect((onCleanup) => {
      const item = this.item();
      this.resolvedArt.set(null);
      const subscription = this.resolveArt(item).subscribe((art) =>
        this.resolvedArt.set(art?.wide ?? null),
      );
      onCleanup(() => subscription.unsubscribe());
    });
    effect(() => {
      const source = this.artwork() ?? this.item().media.coverUrl;
      if (!source) return;
      void this.ambient.colorOf(source).then((color) => this.tint.set(color));
    });
    afterNextRender(() => {
      this.focusFirst();
      if (this.draft() && this.autoCreate()) this.ensure().subscribe();
    });
  }

  pickStatus(status: UserMediaStatus): void {
    if (this.isDraft()) {
      this.begin(status, null).subscribe(() => this.pickStatus(status));
      return;
    }
    if (status === this.data().status) return;
    this.persist({ status }, { ...this.data(), status });
  }

  changeRating(rating: number | null): void {
    const next = statusAfterRating(this.isDraft() ? null : this.data().status, rating);
    if (this.isDraft()) {
      this.begin(next ?? 'planned', rating).subscribe(() => this.changeRating(rating));
      return;
    }
    if (rating === this.data().rating) return;
    const status = next && next !== this.data().status ? next : undefined;
    this.persist(
      { ...(rating === null ? { clearRating: true } : { rating }), ...(status && { status }) },
      { ...this.data(), rating, ...(status && { status }) },
    );
  }

  readonly ensure = (): Observable<CollectionItemResponse> =>
    this.isDraft() ? this.begin('planned', null) : of(this.data());

  private creation: Observable<CollectionItemResponse> | null = null;

  private begin(
    status: UserMediaStatus,
    rating: number | null,
  ): Observable<CollectionItemResponse> {
    return (this.creation ??= this.make(status, rating));
  }

  private make(status: UserMediaStatus, rating: number | null): Observable<CollectionItemResponse> {
    const media = this.data().media;
    this.current.set({ ...this.data(), status, rating });
    this.saving.update((count) => count + 1);
    return this.collectionService
      .create({
        externalId: media.externalId,
        provider: media.provider,
        mediaType: media.mediaType,
        status,
        rating,
      })
      .pipe(
        tap((created) => {
          this.createdLocally.set(true);
          this.current.set(created);
          this.created.emit(created);
          this.flashSaved();
        }),
        catchError((error: unknown) => {
          this.creation = null;
          this.current.set(null);
          catchAndToastError(this.toastService, this.errorMessage)(error);
          return EMPTY;
        }),
        finalize(() => this.saving.update((count) => count - 1)),
        shareReplay(1),
      );
  }

  private persist(
    request: Partial<UpdateCollectionItemRequest>,
    optimistic: CollectionItemResponse,
  ): void {
    const previous = this.data();
    this.current.set(optimistic);
    this.saving.update((count) => count + 1);
    this.collectionService.update(previous.id, request).subscribe({
      next: (updated) => {
        this.saving.update((count) => count - 1);
        this.current.set(updated);
        this.updated.emit(updated);
        this.flashSaved();
      },
      error: (error: unknown) => {
        this.saving.update((count) => count - 1);
        this.current.set(previous);
        catchAndToastError(this.toastService, this.errorMessage)(error);
      },
    });
  }

  private async handOff(run: () => Promise<boolean>): Promise<void> {
    this.suspended.set(true);
    const stayClosed = await run();
    if (stayClosed) return;
    this.cascade.set(false);
    this.suspended.set(false);
    setTimeout(() => this.focusFirst());
  }

  async deleteItem(): Promise<void> {
    const item = this.data();
    await this.handOff(async () => {
      const choice = await this.confirm.choose(
        this.translate.get('collection.delete_confirm_message', { title: item.media.title }),
        {
          title: this.translate.get('collection.delete_confirm_title'),
          confirmLabel: this.translate.get('collection.delete'),
          cancelLabel: this.translate.get('collection.cancel'),
          destructive: true,
        },
      );
      if (choice === 'cancel') return false;
      if (choice === 'dismiss') {
        this.requestClose();
        return true;
      }
      this.deleting.set(true);
      this.collectionService.remove(item.id).subscribe({
        next: () => {
          this.deleting.set(false);
          this.toastService.success(
            this.translate.get('collection.removed', { title: item.media.title }),
          );
          this.requestClose();
        },
        error: (error: unknown) => {
          this.deleting.set(false);
          this.suspended.set(false);
          catchAndToastError(this.toastService, this.errorMessage)(error);
        },
      });
      return true;
    });
  }

  openMediaDetail(): void {
    const media = this.item().media;
    this.requestClose();
    this.router.navigate(['/media', media.mediaType, media.externalId]);
  }

  private flashSaved(): void {
    this.justSaved.set(true);
    if (this.savedTimer) clearTimeout(this.savedTimer);
    this.savedTimer = setTimeout(() => this.justSaved.set(false), SAVED_FLASH_MS);
  }

  openNote(): void {
    this.openStudio('edit');
  }

  openLog(): void {
    this.openStudio('log');
  }

  private openStudio(mode: 'edit' | 'log'): void {
    this.ensure().subscribe({
      next: (item) => {
        this.requestClose();
        void this.router.navigate(['/reviews', item.id, mode]);
      },
    });
  }

  riseDelay(index: number): number | null {
    return this.cascade() ? 60 + Math.min(index, 5) * 40 : null;
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

  private focusFirst(): void {
    const panel = this.panel()?.nativeElement;
    const target =
      panel?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel?.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus({ preventScroll: true });
  }
}
