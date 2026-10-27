import { buttonClasses } from '@shared/ui/button/button';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, type Subscription } from 'rxjs';
import { CollectionService } from '@app/core/services/collection/collection';
import type {
  CollectionItemResponse,
  MediaType,
} from '@app/core/services/collection/collection.model';
import {
  ESSENTIALS_SLOTS,
  type EssentialEntry,
} from '@app/core/services/essentials/essentials.model';
import { EXPLORE_MEDIA_TYPES } from '@app/core/services/search/explore-catalog';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { ButtonComponent } from '@shared/ui/button/button';
import { DialogComponent } from '@shared/ui/dialog/dialog';
import { IconComponent } from '@shared/ui/icon/icon';
import { PickTileComponent } from '@shared/ui/media-picker/pick-tile/pick-tile';
import { SearchbarComponent } from '@shared/ui/searchbar/searchbar';
import { TabsComponent, type TabItem } from '@shared/ui/tabs/tabs';
import { imageRendition } from '@shared/utils/image-rendition.util';
import { observeLoadMore } from '@shared/utils/scroll-observers';

const PAGE_SIZE = 48;
const ALL = 'all';

@Component({
  selector: 'shelfy-essentials-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    DialogComponent,
    FormsModule,
    IconComponent,
    PickTileComponent,
    SearchbarComponent,
    TabsComponent,
    TranslatePipe,
  ],
  template: `
    <shelfy-dialog
      layout="wide"
      [open]="true"
      [label]="'profile.essentials.title' | translate"
      (closed)="closed.emit()"
    >
      <div dialogPanel class="flex min-h-0 flex-1 flex-col">
        <header
          class="flex shrink-0 items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 sm:px-6 sm:pt-6"
        >
          <shelfy-searchbar
            class="min-w-0 flex-1"
            variant="large"
            [placeholder]="'profile.essentials.picker_placeholder' | translate"
            [clearLabel]="'search.clear' | translate"
            [autofocus]="true"
            [ngModel]="query()"
            (ngModelChange)="query.set($event)"
            (cleared)="query.set('')"
          />
          <button
            type="button"
            [class]="closeButton"
            [attr.aria-label]="'dialog.close' | translate"
            title="Esc"
            (click)="dialog()?.requestClose()"
          >
            <shelfy-icon name="close" size="20" />
          </button>
        </header>

        <div class="flex shrink-0 items-center px-4 sm:px-6">
          <shelfy-tabs
            class="[&_.from-background]:from-surface min-w-0 flex-1"
            [tabs]="typeTabs()"
            [activeId]="mediaType() ?? all"
            [label]="'explore.categories' | translate"
            (tabSelected)="selectType($event)"
          />
        </div>

        <div
          #scroller
          class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-5 pb-8 sm:px-6"
          [attr.aria-busy]="status() === 'loading' || saving()"
        >
          <p class="text-text-subtle mb-5 min-h-5 text-sm tabular-nums" role="status">
            @if (full()) {
              {{ 'profile.essentials.picker_full' | translate }}
            } @else if (status() === 'ready' && items().length > 0) {
              {{ 'profile.essentials.picker_count' | translate: { count: total() } }}
            }
          </p>

          @if (selection().length > 0) {
            <section class="mb-8" aria-labelledby="essentials-picked">
              <h3 id="essentials-picked" class="text-text mb-4 text-sm font-semibold">
                {{ 'profile.essentials.picker_in_essentials' | translate }}
              </h3>
              <div [class]="grid + (saving() ? ' pointer-events-none opacity-45' : '')">
                @for (pick of selection(); track pick.id) {
                  <shelfy-pick-tile
                    [title]="pick.title"
                    [poster]="pick.poster"
                    [meta]="pick.meta"
                    [selected]="true"
                    (toggled)="unpick(pick.id)"
                  />
                }
              </div>
            </section>
          }

          @switch (status()) {
            @case ('loading') {
              <div [class]="grid" aria-hidden="true">
                @for (skeleton of skeletons; track skeleton) {
                  <div>
                    <div
                      class="bg-fill-subtle aspect-2/3 animate-pulse rounded-2xl motion-reduce:animate-none"
                    ></div>
                    <div
                      class="bg-fill-subtle mt-2.5 h-3.5 w-3/4 animate-pulse rounded-full motion-reduce:animate-none"
                    ></div>
                  </div>
                }
              </div>
            }
            @case ('error') {
              <div
                class="flex flex-col items-center justify-center gap-4 py-16 text-center"
                role="alert"
              >
                <p class="text-text-muted">{{ 'profile.essentials.picker_error' | translate }}</p>
                <shelfy-button variant="secondary" (click)="fetch(0)">
                  {{ 'explore.retry' | translate }}
                </shelfy-button>
              </div>
            }
            @default {
              @if (items().length === 0) {
                <div
                  class="flex flex-col items-center justify-center gap-3 py-16 text-center"
                  role="status"
                >
                  <shelfy-icon name="search" size="xl" class="text-text-subtle" />
                  <p class="text-text font-semibold">
                    {{
                      query().trim()
                        ? ('profile.essentials.picker_no_match'
                          | translate: { query: query().trim() })
                        : ('profile.essentials.picker_empty' | translate)
                    }}
                  </p>
                </div>
              } @else {
                <div
                  class="duration-base transition-opacity"
                  [class]="grid + (saving() ? ' pointer-events-none opacity-45' : '')"
                >
                  @for (item of unpicked(); track item.id) {
                    <shelfy-pick-tile
                      class="duration-base transition-opacity"
                      [class]="full() ? 'opacity-40' : ''"
                      [title]="item.media.title"
                      [poster]="poster(item)"
                      [meta]="meta(item)"
                      (toggled)="pick(item)"
                    />
                  }
                </div>
                @if (items().length < total()) {
                  <div #sentinel class="mt-8 flex justify-center">
                    <shelfy-button
                      variant="secondary"
                      [loading]="loadingMore()"
                      (click)="loadMore()"
                    >
                      {{ 'explore.load_more' | translate }}
                    </shelfy-button>
                  </div>
                }
              }
            }
          }
        </div>

        <footer
          class="bg-bar flex shrink-0 items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6"
        >
          <div class="flex shrink-0 -space-x-3" aria-hidden="true">
            @for (pick of selection(); track pick.id) {
              <span
                class="bg-surface-raised ring-surface animate-pop-in block h-11 w-7.5 overflow-hidden rounded-md ring-2"
              >
                @if (pick.cover; as src) {
                  <img [src]="src" alt="" class="size-full object-cover" />
                }
              </span>
            }
          </div>
          <p class="text-text min-w-0 flex-1 truncate text-sm font-medium tabular-nums">
            {{
              'profile.essentials.picker_selected'
                | translate: { count: selection().length, max: slots }
            }}
          </p>
          <shelfy-button
            variant="primary"
            [disabled]="!changed()"
            [loading]="saving()"
            (click)="saved.emit(selectedIds())"
          >
            {{ 'profile.essentials.save' | translate }}
          </shelfy-button>
        </footer>
      </div>
    </shelfy-dialog>
  `,
})
export class EssentialsPickerComponent {
  protected readonly closeButton = buttonClasses({
    variant: 'secondary',
    iconOnly: true,
    extraClass: 'shrink-0',
  });
  private readonly collection = inject(CollectionService);
  private readonly translate = inject(TranslateService);

  readonly entries = input<EssentialEntry[]>([]);
  readonly saving = input(false);
  readonly saved = output<string[]>();
  readonly closed = output<void>();

  protected readonly dialog = viewChild(DialogComponent);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');
  protected readonly all = ALL;
  protected readonly skeletons = Array.from({ length: 12 }, (_, i) => i);
  protected readonly grid =
    'grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] sm:gap-x-4 sm:gap-y-7';

  protected readonly query = signal('');
  protected readonly mediaType = signal<MediaType | null>(null);
  protected readonly status = signal<'loading' | 'error' | 'ready'>('loading');
  protected readonly items = signal<CollectionItemResponse[]>([]);
  protected readonly total = signal(0);
  protected readonly loadingMore = signal(false);
  private page = 0;
  private request: Subscription | null = null;

  protected readonly slots = ESSENTIALS_SLOTS;
  protected readonly selection = linkedSignal(() =>
    this.entries().map((entry) => ({
      id: entry.userMediaId,
      title: entry.media.title,
      cover: entry.media.coverUrl,
      poster: this.poster(entry),
      meta: this.meta(entry),
    })),
  );
  protected readonly selectedIds = computed(() => this.selection().map((pick) => pick.id));
  protected readonly unpicked = computed(() => {
    const picked = new Set(this.selectedIds());
    return this.items().filter((item) => !picked.has(item.id));
  });
  protected readonly full = computed(() => this.selection().length >= ESSENTIALS_SLOTS);
  protected readonly changed = computed(
    () =>
      this.selectedIds().join() !==
      this.entries()
        .map((entry) => entry.userMediaId)
        .join(),
  );
  protected readonly typeTabs = computed<TabItem[]>(() => {
    this.translate.lang();
    return [
      { id: ALL, label: this.translate.get('explore.all_types') },
      ...EXPLORE_MEDIA_TYPES.map((type) => ({
        id: type,
        label: this.translate.get(`collection.media_type.${type}`),
      })),
    ];
  });

  constructor() {
    toObservable(computed(() => `${this.mediaType() ?? ALL}|${this.query().trim()}`))
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.fetch(0));

    observeLoadMore(this.sentinel, () => this.loadMore(), this.scroller);
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  protected selectType(id: string): void {
    this.mediaType.set(id === ALL ? null : (id as MediaType));
  }

  protected poster(item: Pick<CollectionItemResponse, 'media'>): string | null {
    const cover = item.media.coverUrl;
    return cover ? imageRendition(cover, 'card') : null;
  }

  protected meta(item: Pick<CollectionItemResponse, 'media'>): string {
    return this.translate.get('collection.media_type_one.' + item.media.mediaType);
  }

  protected pick(item: CollectionItemResponse): void {
    if (this.full()) return;
    this.selection.update((picks) => [
      ...picks,
      {
        id: item.id,
        title: item.media.title,
        cover: item.media.coverUrl,
        poster: this.poster(item),
        meta: this.meta(item),
      },
    ]);
  }

  protected unpick(id: string): void {
    this.selection.update((picks) => picks.filter((pick) => pick.id !== id));
  }

  protected loadMore(): void {
    if (this.status() !== 'ready' || this.loadingMore()) return;
    if (this.items().length >= this.total()) return;
    this.loadingMore.set(true);
    this.fetch(this.page + 1);
  }

  protected fetch(page: number): void {
    this.request?.unsubscribe();
    this.page = page;
    if (page === 0) {
      this.status.set('loading');
      this.items.set([]);
      this.loadingMore.set(false);
      const scroller = this.scroller()?.nativeElement;
      if (scroller) scroller.scrollTop = 0;
    }
    const mediaType = this.mediaType();
    this.request = this.collection
      .list({
        mediaType: mediaType ? [mediaType] : undefined,
        search: this.query().trim() || undefined,
        sortBy: 'rating',
        sortDirection: 'desc',
        page,
        size: PAGE_SIZE,
      })
      .subscribe({
        next: (result) => {
          this.items.update((items) =>
            page === 0 ? result.content : [...items, ...result.content],
          );
          this.total.set(result.totalElements);
          this.status.set('ready');
          this.loadingMore.set(false);
        },
        error: () => {
          if (page === 0) this.status.set('error');
          else this.page = page - 1;
          this.loadingMore.set(false);
        },
      });
  }
}
