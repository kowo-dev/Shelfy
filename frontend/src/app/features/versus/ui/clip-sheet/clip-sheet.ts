import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { MediaResponse } from '@app/core/services/collection/collection.model';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import type { SearchResult } from '@app/core/services/search/search.model';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { VersusService } from '@app/core/services/versus/versus';
import type {
  AddVersusClipRequest,
  UpdateVersusClipRequest,
  VersusEntry,
} from '@app/core/services/versus/versus.model';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { buttonClasses } from '@shared/ui/button/button';
import { FILTER_GROUP_TITLE } from '@shared/ui/ui-recipes';
import { IconComponent } from '@shared/ui/icon/icon';
import { InputComponent } from '@shared/ui/input/input';
import { MediaPickerComponent } from '@shared/ui/media-picker/media-picker';
import { SideSheetComponent } from '@shared/ui/side-sheet/side-sheet';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { injectSearchResultCover } from '@shared/utils/search-result-cover.util';
import { ClipPlayerComponent } from '../clip-player/clip-player';
import { clipSourceUrl } from '../clip-player/clip-embed.util';

@Component({
  selector: 'shelfy-clip-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TranslatePipe,
    IconComponent,
    InputComponent,
    SideSheetComponent,
    MediaPickerComponent,
    ClipPlayerComponent,
  ],
  template: `
    <shelfy-side-sheet
      [title]="(editing() ? 'versus.clip.edit_title' : 'versus.clip.sheet_title') | translate"
      [footer]="true"
      [busy]="loading()"
      (closed)="closed.emit()"
    >
      <section>
        <h3 [class]="label">{{ 'versus.clip.link_label' | translate }}</h3>
        <form class="mt-2.5 flex flex-col gap-2.5" (submit)="$event.preventDefault(); preview()">
          @if (editing()) {
            <p class="text-text-muted truncate text-base" [title]="url()">{{ url() }}</p>
          } @else {
            <div class="flex gap-2">
              <shelfy-input
                class="min-w-0 flex-1"
                type="url"
                name="clipUrl"
                [aria-label]="'versus.clip.link_label' | translate"
                placeholder="https://youtu.be/…"
                [ngModel]="url()"
                (ngModelChange)="url.set($event)"
                (focusout)="preview()"
              />
              <button type="button" [class]="pill" [disabled]="loading()" (click)="paste()">
                <shelfy-icon name="link" size="18" />{{ 'versus.clip.paste' | translate }}
              </button>
            </div>
          }
          <p class="text-text-subtle text-sm">{{ 'versus.clip.link_hint' | translate }}</p>
          @if (recent().length > 0) {
            <div class="animate-fade-in mt-2 flex flex-col gap-1">
              <p class="text-text text-base font-semibold">
                {{ 'versus.clip.added_count' | translate: { count: recent().length } }}
              </p>
              <ul class="text-text-muted flex max-h-28 flex-col gap-0.5 overflow-y-auto text-sm">
                @for (title of recent(); track $index) {
                  <li class="truncate">{{ title }}</li>
                }
              </ul>
            </div>
          }
        </form>
      </section>

      @if (draft(); as entry) {
        <section class="animate-rise-in mt-4 flex flex-col gap-4">
          <div class="bg-surface relative aspect-video overflow-hidden rounded-2xl">
            @if (previewEntry()?.coverUrl; as cover) {
              <img [src]="cover" alt="" class="size-full object-cover" />
            }
            <shelfy-clip-player key="clip-draft" [clip]="entry.clip!" />
          </div>
          <div class="min-w-0">
            <p
              class="font-display text-text truncate text-[1.375rem] leading-tight font-extrabold tracking-[-0.03em]"
            >
              {{ entry.title }}
            </p>
            @if (entry.clip?.author; as author) {
              <p class="text-text-muted mt-1 truncate text-sm">{{ author }}</p>
            }
          </div>
          <div class="mt-2 flex flex-col gap-2.5">
            <h3 [class]="label">{{ 'versus.clip.linked_label' | translate }}</h3>
            @if (link(); as linked) {
              <div class="flex items-center gap-3.5 rounded-2xl bg-white/5 p-2.5 pr-4">
                <span class="bg-surface block aspect-2/3 w-11 shrink-0 overflow-hidden rounded-lg">
                  @if (cover(linked); as poster) {
                    <img [src]="poster" alt="" class="size-full object-cover" />
                  }
                </span>
                <span class="text-text min-w-0 flex-1 truncate text-base font-semibold">{{
                  linked.title
                }}</span>
                <button
                  type="button"
                  class="text-text-muted hover:text-text shrink-0 cursor-pointer text-sm font-semibold transition-colors"
                  (click)="link.set(null)"
                >
                  {{ 'versus.clip.unlink' | translate }}
                </button>
              </div>
            } @else {
              <button type="button" [class]="small + ' self-start'" (click)="pickerOpen.set(true)">
                <shelfy-icon name="plus" size="18" />{{ 'versus.clip.link_button' | translate }}
              </button>
            }
            <p class="text-text-subtle text-sm">{{ 'versus.clip.linked_hint' | translate }}</p>
          </div>
        </section>
      }

      <ng-container sheetFooter>
        <button type="button" [class]="pill + ' flex-1'" (click)="closed.emit()">
          {{ (recent().length ? 'versus.clip.done' : 'versus.form.cancel') | translate }}
        </button>
        <button
          type="button"
          [class]="primary + ' flex-1'"
          [disabled]="!canSubmit()"
          (click)="submit()"
        >
          {{ (editing() ? 'versus.clip.save' : 'versus.clip.add') | translate }}
        </button>
      </ng-container>
    </shelfy-side-sheet>

    <shelfy-media-picker
      heading="shared.media_picker.link_title"
      [open]="pickerOpen()"
      [alreadySelected]="[]"
      (picked)="link.set($event); pickerOpen.set(false)"
      (closed)="pickerOpen.set(false)"
    />
  `,
})
export class ClipSheetComponent implements OnInit {
  private readonly versus = inject(VersusService);
  private readonly toast = inject(ToastService);
  private readonly errorMessage = inject(ErrorMessageService);
  private readonly translate = inject(TranslateService);
  protected readonly cover = injectSearchResultCover();

  readonly editing = input<VersusEntry | null>(null);
  readonly added = output<AddVersusClipRequest>();
  readonly updated = output<{ entryId: string; request: UpdateVersusClipRequest }>();
  readonly closed = output<void>();

  readonly pill = buttonClasses({ variant: 'secondary' });
  readonly small = buttonClasses({ variant: 'secondary', size: 'sm' });
  readonly primary = buttonClasses({ variant: 'primary' });
  readonly label = FILTER_GROUP_TITLE;

  readonly url = signal('');
  readonly previewEntry = signal<VersusEntry | null>(null);
  readonly loading = signal(false);
  readonly link = signal<SearchResult | null>(null);
  readonly pickerOpen = signal(false);
  readonly recent = signal<string[]>([]);
  readonly canSubmit = computed(() => !!this.previewEntry() && !this.loading());

  readonly draft = computed<VersusEntry | null>(() => {
    const preview = this.previewEntry();
    if (!preview?.clip) return null;
    const linked = this.link();
    return {
      ...preview,
      title: preview.clip.title,
      coverUrl: linked ? this.cover(linked) : preview.coverUrl,
      media: null,
    };
  });

  ngOnInit(): void {
    const entry = this.editing();
    if (!entry?.clip) return;
    this.url.set(clipSourceUrl(entry.clip));
    this.link.set(entry.media ? toSearchResult(entry.media) : null);
    this.preview();
  }

  preview(): void {
    const url = this.url().trim();
    if (!url || this.loading()) return;
    this.loading.set(true);
    this.versus.resolveClip(url).subscribe({
      next: (entry) => {
        this.loading.set(false);
        this.previewEntry.set(entry);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.previewEntry.set(null);
        catchAndToastError(this.toast, this.errorMessage)(error);
      },
    });
  }

  paste(): void {
    const clipboard = globalThis.navigator?.clipboard;
    if (!clipboard?.readText) {
      this.toast.info(this.translate.get('versus.clip.paste_blocked'));
      return;
    }
    clipboard
      .readText()
      .then((text) => {
        if (!text.trim()) return;
        this.url.set(text.trim());
        this.preview();
      })
      .catch(() => this.toast.info(this.translate.get('versus.clip.paste_blocked')));
  }

  submit(): void {
    const entry = this.draft();
    if (!entry?.clip || !this.canSubmit()) return;
    const linked = this.link();
    const linkedMedia = linked
      ? { provider: linked.provider, mediaType: linked.mediaType, externalId: linked.externalId }
      : null;
    const editing = this.editing();
    if (editing) {
      this.updated.emit({
        entryId: editing.id,
        request: { startSeconds: editing.clip?.startSeconds ?? null, linkedMedia },
      });
      this.closed.emit();
      return;
    }
    this.added.emit({ url: this.url().trim(), startSeconds: entry.clip.startSeconds, linkedMedia });
    this.recent.update((titles) => [entry.clip!.title, ...titles]);
    this.url.set('');
    this.previewEntry.set(null);
    this.link.set(null);
  }
}

function toSearchResult(media: MediaResponse): SearchResult {
  return {
    provider: media.provider,
    mediaType: media.mediaType,
    externalId: media.externalId,
    title: media.title,
    posterPath: media.coverUrl,
    overview: '',
    releaseYear: null,
    genres: [],
    voteAverage: null,
    voteCount: null,
    status: null,
    isInCollection: false,
  };
}
