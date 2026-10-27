import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, switchMap, type Observable } from 'rxjs';
import type { UnsavedChangesAware } from '@app/core/guards/unsaved-changes-guard';
import { AuthService } from '@app/core/services/auth/auth';
import { CollectionService } from '@app/core/services/collection/collection';
import type {
  CollectionItemResponse,
  MediaType,
  UserMediaStatus,
} from '@app/core/services/collection/collection.model';
import { isMediaType } from '@app/core/services/collection/collection.model';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { WatchLogService } from '@app/core/services/watch-log/watch-log';
import type {
  UpsertWatchLogRequest,
  WatchLogEntry,
} from '@app/core/services/watch-log/watch-log.model';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { CheckboxComponent } from '@shared/ui/checkbox/checkbox';
import { MediaHeaderComponent } from '@shared/ui/media-header/media-header';
import { RatingBlockComponent } from '@shared/ui/rating-block/rating-block';
import { buttonClasses } from '@shared/ui/button/button';
import { EditBarComponent, type EditBarState } from '@shared/ui/edit-bar/edit-bar';
import { IconComponent } from '@shared/ui/icon/icon';
import { InputComponent } from '@shared/ui/input/input';
import { StatusPickerComponent } from '@shared/ui/item-sheet/ui/status-picker/status-picker';
import { RichTextEditorComponent } from '@shared/ui/rich-text/rich-text-editor';
import { SpinnerComponent } from '@shared/ui/spinner/spinner';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { PROGRESS_STATUSES } from '@shared/utils/collection-status.util';
import { todayIsoDate } from '@shared/utils/local-date.util';
import { mediaLogKind } from '@shared/utils/media-log-kind.util';
import {
  isRichTextEmpty,
  richTextDocument,
  richTextPlainText,
  type RichTextContent,
} from '@shared/utils/rich-text.util';

const AUTOSAVE_DELAY_MS = 900;

interface Work {
  provider: string;
  mediaType: MediaType;
  externalId: string;
  title: string;
  coverUrl: string | null;
}

@Component({
  selector: 'shelfy-review-studio-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TranslatePipe,
    CheckboxComponent,
    InputComponent,
    MediaHeaderComponent,
    EditBarComponent,
    IconComponent,
    RatingBlockComponent,
    StatusPickerComponent,
    RichTextEditorComponent,
    SpinnerComponent,
  ],
  templateUrl: './review-studio.html',
})
export class ReviewStudioPageComponent implements UnsavedChangesAware {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly openedInApp = !!this.router.currentNavigation()?.previousNavigation;
  private readonly collection = inject(CollectionService);
  private readonly watchLog = inject(WatchLogService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly onError = catchAndToastError(this.toast, inject(ErrorMessageService));

  readonly statuses: UserMediaStatus[] = [...PROGRESS_STATUSES, 'planned'];
  protected readonly primaryButton = buttonClasses({
    variant: 'primary',
    extraClass: 'gap-2.5',
  });
  protected readonly ghostButton =
    'text-text-muted hover:text-text h-13 cursor-pointer px-4 text-base font-semibold transition-colors';
  readonly item = signal<CollectionItemResponse | null>(null);
  readonly work = signal<Work | null>(null);
  readonly loading = signal(true);

  readonly content = signal<RichTextContent | null>(null);
  readonly initialContent = signal<RichTextContent | null>(null);
  readonly rating = signal<number | null>(null);
  readonly spoiler = signal(false);
  readonly status = signal<UserMediaStatus>('done');
  readonly saveState = signal<EditBarState>('idle');
  readonly saving = signal(false);
  readonly dirty = signal(false);

  readonly logMode = this.route.snapshot.data['studio'] === 'log';
  readonly entry = signal<WatchLogEntry | null>(null);
  readonly logDate = signal(todayIsoDate());
  readonly logRepeat = signal(false);
  readonly confirmingDelete = signal(false);
  readonly dateInvalid = computed(() => !/^\d{4}-\d{2}-\d{2}$/.test(this.logDate()));
  readonly logKind = computed(() => mediaLogKind(this.mediaType() ?? 'movie'));

  readonly isNew = computed(() => this.item() === null);
  readonly empty = computed(() => isRichTextEmpty(this.content()));
  readonly wordCount = computed(() => richTextPlainText(this.content()).match(/\S+/g)?.length ?? 0);
  readonly title = computed(() => this.item()?.media.title ?? this.work()?.title ?? '');
  readonly coverUrl = computed(() => this.item()?.media.coverUrl ?? this.work()?.coverUrl ?? null);
  readonly heroBackdrop = computed(() => {
    const backdrop = this.item()?.media.metadata?.['backdropUrl'];
    return typeof backdrop === 'string' && backdrop ? backdrop : null;
  });
  readonly mediaType = computed(
    () => this.item()?.media.mediaType ?? this.work()?.mediaType ?? null,
  );
  readonly visibilityKey = computed(
    () =>
      ({
        public: 'studio.visibility.public',
        link: 'studio.visibility.public',
        private: 'studio.visibility.private',
      })[this.auth.currentUser()?.profileVisibility ?? 'public'],
  );
  readonly canFinish = computed(() =>
    this.logMode ? !this.dateInvalid() : !this.empty() && this.saveState() === 'idle',
  );
  readonly kicker = computed(() => {
    if (!this.logMode) return 'review.studio.text';
    return `collection.history.${this.entry() ? 'edit_title' : 'add'}.${this.logKind()}`;
  });
  readonly finishLabel = computed(() => {
    if (this.logMode) return this.entry() ? 'edit.done' : this.kicker();
    return this.isNew() ? 'studio.publish' : 'edit.done';
  });
  readonly hint = computed(() => {
    if (this.logMode) {
      if (this.dateInvalid()) return 'collection.history.date_required';
      return this.entry() ? 'review.studio.log_edit_hint' : 'review.studio.log_new_hint';
    }
    if (this.empty()) return 'review.studio.write_first';
    if (this.isNew()) return 'review.studio.new_hint';
    return this.saving() || this.dirty() ? 'edit.autosaving' : 'edit.autosaved';
  });

  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.flush());
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadItem(id);
      return;
    }
    const query = this.route.snapshot.queryParamMap;
    const provider = query.get('provider');
    const mediaType = query.get('mediaType');
    const externalId = query.get('externalId');
    if (!provider || !isMediaType(mediaType) || !externalId) {
      void this.router.navigateByUrl('/creations', { replaceUrl: true });
      return;
    }
    this.collection.lookup(provider, mediaType, externalId).subscribe({
      next: (own) => {
        if (own) {
          void this.router.navigate(['/reviews', own.id, 'edit'], { replaceUrl: true });
          return;
        }
        this.work.set({
          provider,
          mediaType,
          externalId,
          title: query.get('title') ?? '',
          coverUrl: query.get('cover'),
        });
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.onError(error);
        void this.router.navigateByUrl('/creations', { replaceUrl: true });
      },
    });
  }

  hasUnsavedChanges(): boolean {
    if (this.logMode) return this.dirty() && this.saveState() === 'idle';
    return this.isNew() ? !this.empty() && this.saveState() === 'idle' : this.saving();
  }

  onContent(content: RichTextContent): void {
    this.content.set(content);
    this.schedule();
  }

  onRating(rating: number | null): void {
    this.rating.set(rating);
    this.schedule();
  }

  onSpoiler(value: boolean): void {
    this.spoiler.set(value);
    this.schedule();
  }

  onLogDate(value: string): void {
    this.logDate.set(value);
    this.dirty.set(true);
  }

  onLogRepeat(value: boolean): void {
    this.logRepeat.set(value);
    this.dirty.set(true);
  }

  close(): void {
    const item = this.item();
    if (item && !this.logMode) this.flush();
    if (this.openedInApp) this.location.back();
    else if (item) void this.router.navigate(['/reviews', item.id], { replaceUrl: true });
    else void this.router.navigateByUrl('/creations', { replaceUrl: true });
  }

  finish(): void {
    if (this.logMode) {
      this.saveLog();
      return;
    }
    if (this.empty()) return;
    const item = this.item();
    if (!item) {
      this.publish();
      return;
    }
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.saveState.set('saving');
    this.save(item.id).subscribe({
      next: (saved) => {
        this.saveState.set('saved');
        this.leave(saved.id);
      },
      error: (error: unknown) => {
        this.saveState.set('idle');
        this.onError(error);
      },
    });
  }

  private publish(): void {
    const work = this.work();
    if (!work) return;
    this.saveState.set('saving');
    this.collection
      .create({
        provider: work.provider,
        mediaType: work.mediaType,
        externalId: work.externalId,
        status: this.status(),
        rating: this.rating(),
      })
      .pipe(switchMap((created) => this.save(created.id)))
      .subscribe({
        next: (saved) => {
          this.saveState.set('saved');
          this.toast.success(this.translate.get('review.studio.published'));
          this.leave(saved.id);
        },
        error: (error: unknown) => {
          this.saveState.set('idle');
          this.onError(error);
        },
      });
  }

  deleteLog(): void {
    const item = this.item();
    const entry = this.entry();
    if (!item || !entry) return;
    if (!this.confirmingDelete()) {
      this.confirmingDelete.set(true);
      return;
    }
    this.commitLog(item.id, this.watchLog.delete(item.id, entry.id));
  }

  private saveLog(): void {
    const item = this.item();
    if (!item || this.dateInvalid()) return;
    const content = this.content();
    const empty = isRichTextEmpty(content);
    const entry = this.entry();
    const request: UpsertWatchLogRequest = {
      occurredAt: this.logDate(),
      isRewatch: this.logRepeat(),
      name: entry?.name ?? null,
      rating: this.rating(),
      review: empty ? null : (content as Record<string, unknown>),
      containsSpoilers: !empty && this.spoiler(),
    };
    this.commitLog(
      item.id,
      entry
        ? this.watchLog.update(item.id, entry.id, request)
        : this.watchLog.create(item.id, request),
    );
  }

  private commitLog(itemId: string, request$: Observable<unknown>): void {
    this.saveState.set('saving');
    request$.pipe(switchMap(() => this.collection.refreshItem(itemId))).subscribe({
      next: () => {
        this.saveState.set('saved');
        this.dirty.set(false);
        this.leave(itemId);
      },
      error: (error: unknown) => {
        this.saveState.set('idle');
        this.onError(error);
      },
    });
  }

  private leave(id: string): void {
    if (this.openedInApp) this.location.back();
    else void this.router.navigate(['/reviews', id], { replaceUrl: true });
  }

  private loadItem(id: string): void {
    if (this.logMode) {
      this.loadLog(id);
      return;
    }
    this.collection.getItem(id).subscribe({
      next: (item) => {
        this.item.set(item);
        this.fill(item.note, item.rating, item.containsSpoilers);
        this.status.set(item.status);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.onError(error);
        void this.router.navigateByUrl('/creations', { replaceUrl: true });
      },
    });
  }

  private loadLog(id: string): void {
    const logId = this.route.snapshot.paramMap.get('logId');
    forkJoin([this.collection.getItem(id), this.watchLog.list(id)]).subscribe({
      next: ([item, entries]) => {
        const entry = entries.find((candidate) => candidate.id === logId) ?? null;
        if (logId && !entry) {
          void this.router.navigate(['/reviews', id], { replaceUrl: true });
          return;
        }
        this.item.set(item);
        this.entry.set(entry);
        this.fill(entry?.review ?? null, entry?.rating ?? null, entry?.containsSpoilers ?? false);
        this.logDate.set(entry?.occurredAt ?? todayIsoDate());
        this.logRepeat.set(entry?.isRewatch ?? entries.length > 0);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.onError(error);
        void this.router.navigateByUrl('/creations', { replaceUrl: true });
      },
    });
  }

  private fill(
    note: CollectionItemResponse['note'],
    rating: number | null,
    spoiler: boolean,
  ): void {
    const content = richTextDocument(note) as RichTextContent;
    this.content.set(content);
    this.initialContent.set(content);
    this.rating.set(rating);
    this.spoiler.set(spoiler);
  }

  private save(id: string): Observable<CollectionItemResponse> {
    const content = this.content();
    const empty = isRichTextEmpty(content);
    const rating = this.rating();
    return this.collection.update(id, {
      note: empty ? null : content,
      clearNote: empty,
      containsSpoilers: this.spoiler(),
      ...(rating === null ? { clearRating: true } : { rating }),
    });
  }

  private schedule(): void {
    if (this.logMode) {
      this.dirty.set(true);
      return;
    }
    if (this.isNew()) return;
    this.dirty.set(true);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.autosave();
    }, AUTOSAVE_DELAY_MS);
  }

  private flush(): void {
    if (this.logMode) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.dirty()) this.autosave();
  }

  private autosave(): void {
    const item = this.item();
    if (!item || this.empty()) return;
    this.dirty.set(false);
    this.saving.set(true);
    this.save(item.id).subscribe({
      next: () => this.saving.set(false),
      error: (error: unknown) => {
        this.saving.set(false);
        this.dirty.set(true);
        this.onError(error);
      },
    });
  }
}
