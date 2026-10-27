import { SegmentedComponent } from '@shared/ui/segmented/segmented';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { ListsService } from '@app/core/services/lists/lists';
import type { MediaListResponse } from '@app/core/services/lists/lists.model';
import { AuthService } from '@app/core/services/auth/auth';
import type { SearchResult } from '@app/core/services/search/search.model';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { catchAndToastError } from '@app/shared/utils/catch-and-toast-error.util';
import { TranslateService } from '@app/core/services/translate/translate';
import { AdultGateService } from '@app/core/services/adult-gate/adult-gate';
import type {
  CollectionItemResponse,
  MediaResponse,
} from '@app/core/services/collection/collection.model';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { EntityMediaGridComponent } from '@app/features/entity/ui/entity-media-grid';
import { AdultBadgeComponent } from '@shared/ui/adult-badge/adult-badge';
import { IconComponent } from '@shared/ui/icon/icon';
import { CollaboratorsSheetComponent } from '@shared/ui/collaborators-sheet/collaborators-sheet';
import { MediaPickerComponent } from '@shared/ui/media-picker/media-picker';
import { CommentsComponent } from '@shared/ui/comments/comments';
import { toPlaceholderCollectionItem } from '@shared/utils/media-placeholder-item.util';
import { AvatarComponent } from '@shared/ui/avatar/avatar';
import { CollabInviteBannerComponent } from '@shared/ui/collab-invite-banner/collab-invite-banner';
import { PageFooterComponent } from '@shared/ui/page-footer/page-footer';
import { PublishDialogComponent } from '@shared/ui/publish-dialog/publish-dialog';
import type { CollectionVisibility } from '@app/core/services/auth/auth.model';
import type { IconName } from '@shared/ui/icon/icon-registry';
import type { MoveTarget } from '@shared/utils/move-block.util';
import { ShelfLookupService } from '@app/core/services/shelf-lookup/shelf-lookup';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import type { UnsavedChangesAware } from '@app/core/guards/unsaved-changes-guard';
import type { TabItem } from '@shared/ui/tabs/tabs';
import {
  BULK_BAR,
  CHECKBOX,
  CHECKBOX_OFF,
  CHECKBOX_ON,
  CHIP,
  CHIP_OFF,
  CHIP_ON,
  HIT_AREA_40,
  MEDIA_CHIP,
  TAG_CHIP,
  TAG_CHIP_ADD,
} from '@shared/ui/ui-recipes';
import { MediaHeaderComponent } from '@shared/ui/media-header/media-header';
import { TabsComponent } from '@shared/ui/tabs/tabs';
import { featuredMediaBackdropUrl } from '@shared/utils/media-backdrop.util';
import { createListEditState, MAX_TAGS } from './state/list-edit-state';
import type { CommentsSource } from '@shared/ui/comments/comments.model';
import { buttonClasses } from '@shared/ui/button/button';
import {
  creationVisibilityInfo,
  isSharedCreation,
  dropLegacyEditParam,
  focusCreationTitle,
} from '@shared/utils/creation-page.util';
import { EmptyStateComponent } from '@shared/ui/empty-state/empty-state';
import { DetailSkeletonComponent } from '@shared/ui/detail-skeleton/detail-skeleton';
import { ButtonComponent } from '@shared/ui/button/button';
import { SelectionToggleComponent } from '@shared/ui/selection-toggle/selection-toggle';
import { SelectionRemoveComponent } from '@shared/ui/selection-remove/selection-remove';
import { createCollaborationState } from '@shared/utils/collaboration-state';

@Component({
  selector: 'shelfy-list-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SegmentedComponent,
    SelectionToggleComponent,
    SelectionRemoveComponent,
    RouterLink,
    TranslatePipe,
    EntityMediaGridComponent,
    AdultBadgeComponent,
    IconComponent,
    CollaboratorsSheetComponent,
    MediaPickerComponent,
    CommentsComponent,
    MediaHeaderComponent,
    TabsComponent,
    AvatarComponent,
    CollabInviteBannerComponent,
    PageFooterComponent,
    PublishDialogComponent,
    EmptyStateComponent,
    DetailSkeletonComponent,
    ButtonComponent,
  ],
  templateUrl: './list-detail.html',
})
export class ListDetailPageComponent implements UnsavedChangesAware {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly adultGate = inject(AdultGateService);
  private readonly lists = inject(ListsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly errorMessage = inject(ErrorMessageService);
  private readonly translate = inject(TranslateService);
  private readonly shelf = inject(ShelfLookupService);
  private readonly confirm = inject(ConfirmService);
  private readonly refresh = new Subject<void>();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly tagChip = TAG_CHIP;
  protected readonly tagAdd = TAG_CHIP_ADD;
  protected readonly chip = CHIP;
  protected readonly chipOn = CHIP_ON;
  protected readonly chipOff = CHIP_OFF;
  readonly bulkBar = BULK_BAR;
  readonly bulkIcon = buttonClasses({ variant: 'secondary', iconOnly: true });
  readonly checkbox = CHECKBOX;
  readonly checkboxOn = CHECKBOX_ON;
  readonly checkboxOff = CHECKBOX_OFF;
  readonly hitArea = HIT_AREA_40;
  readonly mediaChip = MEDIA_CHIP;
  readonly maxTags = MAX_TAGS;
  readonly moves: readonly { target: MoveTarget; icon: IconName; label: string }[] = [
    { target: 'top', icon: 'toTop', label: 'edit.selection.to_top' },
    { target: 'up', icon: 'arrowUp', label: 'edit.selection.up' },
    { target: 'down', icon: 'arrowDown', label: 'edit.selection.down' },
    { target: 'bottom', icon: 'toBottom', label: 'edit.selection.to_bottom' },
  ];
  readonly signedIn = this.auth.isAuthenticated;
  readonly filter = signal<'all' | 'unseen'>('all');
  readonly tab = signal<'titles' | 'discussion'>(
    this.route.snapshot.queryParamMap.get('tab') === 'discussion' ? 'discussion' : 'titles',
  );
  private fresh = !!this.router.currentNavigation()?.extras.state?.['fresh'];

  readonly list = signal<MediaListResponse | null>(null);
  readonly edit = createListEditState(this.list);
  readonly publishOpen = signal(false);
  readonly loading = signal(true);
  readonly failed = signal(false);
  private readonly listId = signal('');
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  readonly pageTabs = computed<TabItem[]>(() => {
    this.translate.lang();
    const list = this.list();
    return [
      {
        id: 'titles',
        label: this.translate.get('creation.tabs.titles'),
        count: list ? this.edit.media().length : null,
      },
      {
        id: 'discussion',
        label: this.translate.get('creation.tabs.discussion'),
        count: this.commentTotal() ?? list?.commentCount ?? null,
      },
    ];
  });
  readonly canLeave = computed(() => this.isCollaborator() && !this.isOwner());
  readonly libraryRoute = computed(() => {
    const username = this.params().get('username');
    return username ? ['/profile', username, 'lists'] : ['/creations'];
  });
  readonly isOwner = computed(() => this.list()?.userId === this.auth.currentUser()?.id);
  readonly isCollaborator = computed(() => this.list()?.viewerCollaboratorStatus === 'ACCEPTED');
  readonly isPendingInvite = computed(() => this.list()?.viewerCollaboratorStatus === 'PENDING');
  readonly canEditItems = computed(() => this.list()?.canEditItems ?? false);
  readonly canEditDetails = this.isOwner;
  readonly showAuthors = computed(() => {
    const list = this.list();
    if (!list) return false;
    const authors = new Set(list.items.map((item) => item.addedBy?.userId).filter(Boolean));
    return authors.size > 1 || list.collaborators.length > 0;
  });
  readonly selectedIds = computed(() => {
    const picked = this.edit.selected();
    return this.visibleRows()
      .map((row) => row.media.id)
      .filter((id) => picked.has(id));
  });
  readonly selectedCount = computed(() => this.selectedIds().length);
  readonly allSelected = computed(
    () => this.visibleRows().length > 0 && this.selectedCount() === this.visibleRows().length,
  );
  readonly liking = signal(false);
  readonly commentTotal = signal<number | null>(null);
  readonly visibilityInfo = computed(() =>
    creationVisibilityInfo(this.list()?.visibility, isSharedCreation(this.list())),
  );
  readonly isShared = computed(() => isSharedCreation(this.list()));

  readonly heroMeta = computed(() => {
    this.translate.lang();
    const list = this.list();
    if (!list) return [];
    const visibility =
      list.visibility === 'public'
        ? []
        : [
            this.translate.get(
              this.isOwner() && list.visibility === 'private' && !isSharedCreation(list)
                ? 'lists.manage.draft'
                : this.visibilityInfo().labelKey,
            ),
          ];
    const status = this.saveStatus();
    return [
      this.translate.get('lists.element', { count: this.edit.media().length }),
      ...visibility,
      ...(status ? [status] : []),
    ];
  });

  readonly saveStatus = computed(() => {
    this.translate.lang();
    if (!this.canEditItems()) return null;
    if (this.edit.detailsState() === 'error') return this.translate.get('lists.manage.not_saved');
    if (this.edit.saving()) return this.translate.get('edit.autosaving');
    return this.edit.detailsState() === 'saved' ? this.translate.get('edit.saved') : null;
  });

  readonly rows = computed(() =>
    this.edit.media().map((media, index) => {
      const owned = this.shelf.find(media);
      return { media, rank: index + 1, owned, seen: isSeen(owned) };
    }),
  );
  readonly visibleItems = computed(() =>
    this.visibleRows().map((row) => toPlaceholderCollectionItem(row.media)),
  );
  readonly artCovers = computed(() => this.edit.media().slice(0, 4));
  readonly coAuthors = computed(() => this.list()?.collaborators ?? []);
  protected readonly primaryButton = buttonClasses({
    variant: 'primary',
    extraClass: 'gap-2.5',
  });
  protected readonly secondaryButton = buttonClasses({
    variant: 'secondary',
    size: 'sm',
  });
  protected readonly social =
    'text-text hover:text-text-muted inline-flex h-11 cursor-pointer items-center gap-2 text-base font-semibold transition-colors disabled:opacity-50';
  protected readonly manage =
    'text-text-subtle hover:text-text inline-flex h-9 cursor-pointer items-center gap-1.5 text-sm font-semibold transition-colors disabled:opacity-50';
  readonly descriptionOpen = signal(false);
  private readonly barSentinel = viewChild<ElementRef<HTMLElement>>('barSentinel');
  readonly stuck = signal(false);
  readonly backdrop = computed(() =>
    featuredMediaBackdropUrl(this.edit.media().filter((media) => !media.isAdult)),
  );
  readonly ctaKind = computed<'publish' | 'add' | 'like'>(() => {
    const list = this.list();
    if (!this.canEditItems() && !this.isOwner()) return 'like';
    const draft =
      this.isOwner() && list?.visibility === 'private' && !isSharedCreation(list ?? null);
    return draft && this.edit.media().length > 0 ? 'publish' : 'add';
  });
  readonly likeTotal = computed(() => this.list()?.likeCount ?? 0);
  readonly unseenCount = computed(() => this.rows().filter((row) => !row.seen).length);
  readonly visibleRows = computed(() =>
    this.filter() === 'unseen' ? this.rows().filter((row) => !row.seen) : this.rows(),
  );
  readonly filterLinks = computed(() => {
    this.translate.lang();
    return [
      { id: 'all', label: this.translate.get('community.list.all'), count: this.rows().length },
      {
        id: 'unseen',
        label: this.translate.get('community.list.unseen'),
        count: this.unseenCount(),
      },
    ];
  });

  readonly collab = createCollaborationState({
    target: this.list,
    viewerId: computed(() => this.auth.currentUser()?.id ?? null),
    api: {
      invite: (id, userId) => this.lists.inviteCollaborator(id, userId),
      accept: (id) => this.lists.acceptCollaboratorInvite(id),
      decline: (id) => this.lists.declineCollaboratorInvite(id),
      remove: (id, userId) => this.lists.removeCollaborator(id, userId),
    },
    changed: () => this.refresh.next(),
    gone: () => void this.router.navigate(this.libraryRoute()),
  });

  readonly mediaPickerOpen = signal(false);

  constructor() {
    effect(() => {
      const media = this.list()?.media ?? [];
      if (this.signedIn()) untracked(() => media.forEach((item) => this.shelf.request(item)));
    });
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.focusFreshTitle();
      dropLegacyEditParam(this.route, this.router);
      const scroller = document.querySelector('.app-main') ?? window;
      const onScroll = () => this.measureBar();
      scroller.addEventListener('scroll', onScroll, { passive: true });
      destroyRef.onDestroy(() => scroller.removeEventListener('scroll', onScroll));
    });
    effect(() => {
      if (this.list() && this.fresh) untracked(() => setTimeout(() => this.focusFreshTitle()));
    });
    destroyRef.onDestroy(() => this.dropUntouchedDraft());
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.listId.set(params.get('id') ?? '');
      this.loadList();
    });
    this.refresh.pipe(takeUntilDestroyed()).subscribe(() => this.loadList());
  }

  private measureBar(): void {
    const sentinel = this.barSentinel()?.nativeElement;
    if (!sentinel) return;
    const nav =
      window.innerWidth >= 768
        ? parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--nav-bar-height'),
          ) || 76
        : 0;
    this.stuck.set(sentinel.getBoundingClientRect().top < nav - 0.5);
  }

  retry(): void {
    this.loadList();
  }

  private loadList(): void {
    const id = this.listId();
    if (!id) return;
    this.loading.set(true);
    this.failed.set(false);
    this.lists.get(id).subscribe({
      next: (list) => {
        this.list.set(list);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.list.set(null);
        this.failed.set(true);
        this.loading.set(false);
        catchAndToastError(this.toast, this.errorMessage)(error);
      },
    });
  }

  hasUnsavedChanges(): boolean {
    return this.edit.hasUnsaved();
  }

  private focusFreshTitle(): void {
    if (!this.fresh || !this.isOwner()) return;
    focusCreationTitle(this.host.nativeElement);
  }

  private dropUntouchedDraft(): void {
    const list = this.list();
    const untouched =
      this.fresh &&
      !!list &&
      this.isOwner() &&
      list.visibility === 'private' &&
      this.edit.media().length === 0 &&
      this.edit.name().trim() === this.translate.get('studio.untitled_list') &&
      !this.edit.description().trim() &&
      this.edit.tags().length === 0 &&
      list.collaborators.length === 0 &&
      list.pendingInvites.length === 0;
    if (untouched) this.lists.delete(list.id).subscribe({ error: () => undefined });
  }

  publish(visibility: CollectionVisibility): void {
    this.publishOpen.set(false);
    this.edit.publish(visibility);
  }

  onTagKey(event: KeyboardEvent, field: HTMLInputElement): void {
    if (event.key === 'Backspace' && !field.value && this.edit.tags().length > 0) {
      this.edit.removeTag(this.edit.tags().at(-1)!);
      return;
    }
    if (event.key !== 'Enter' && event.key !== ',') return;
    event.preventDefault();
    this.commitTag(field);
  }

  commitTag(field: HTMLInputElement): void {
    if (this.edit.addTag(field.value)) field.value = '';
  }

  selectAllVisible(): void {
    this.edit.selectAll(this.visibleRows().map((row) => row.media.id));
  }

  selectTab(id: string): void {
    const next = id === 'discussion' ? 'discussion' : 'titles';
    this.tab.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: next === 'titles' ? null : next },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  setFilter(id: string): void {
    this.filter.set(id === 'unseen' ? 'unseen' : 'all');
  }

  async deleteList(): Promise<void> {
    const list = this.list();
    if (!list) return;
    const confirmed = await this.confirm.ask(
      this.translate.get('studio.delete_message', { name: list.name }),
      {
        title: this.translate.get('studio.delete_title'),
        confirmLabel: this.translate.get('studio.delete'),
        destructive: true,
      },
    );
    if (!confirmed) return;
    this.lists.delete(list.id).subscribe({
      next: () => {
        this.toast.success(this.translate.get('studio.deleted'));
        void this.router.navigateByUrl('/creations?f=lists&scope=MINE', { replaceUrl: true });
      },
      error: catchAndToastError(this.toast, this.errorMessage),
    });
  }

  commentsSource(listId: string): CommentsSource {
    return {
      list: (page, size, sort) => this.lists.comments(listId, page, size, sort),
      add: (content, parentCommentId) => this.lists.comment(listId, content, parentCommentId),
      update: (commentId, content) => this.lists.updateComment(listId, commentId, content),
      remove: (commentId) => this.lists.deleteComment(listId, commentId),
      vote: (commentId, value) => this.lists.voteComment(listId, commentId, value),
      removeVote: (commentId) => this.lists.removeCommentVote(listId, commentId),
    };
  }

  goToMedia(media: MediaResponse): void {
    if (media.isAdult && !media.title) {
      void this.adultGate.open();
      return;
    }
    this.router.navigate(['/media', media.mediaType, media.externalId]);
  }

  toggleLike(): void {
    const list = this.list();
    if (!list || this.isOwner() || this.liking()) return;
    const liked = !list.isLikedByViewer;
    this.list.set({
      ...list,
      isLikedByViewer: liked,
      likeCount: list.likeCount + (liked ? 1 : -1),
    });
    this.liking.set(true);
    const request = liked ? this.lists.like(list.id) : this.lists.unlike(list.id);
    request.subscribe({
      next: () => this.liking.set(false),
      error: (error: unknown) => {
        this.liking.set(false);
        this.list.set(list);
        catchAndToastError(this.toast, this.errorMessage)(error);
      },
    });
  }

  openMediaPicker(): void {
    this.mediaPickerOpen.set(true);
  }

  closeMediaPicker(): void {
    this.mediaPickerOpen.set(false);
  }

  removeByKey(item: SearchResult): void {
    const key = mediaKey(item);
    const media = this.edit.media().find((m) => mediaKey(m) === key);
    if (media) this.edit.remove([media.id]);
  }
}

function mediaKey(item: { provider: string; mediaType: string; externalId: string }): string {
  return `${item.provider}:${item.mediaType}:${item.externalId}`;
}

function isSeen(item: CollectionItemResponse | null): boolean {
  return item?.status === 'done';
}
