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
import { AuthService } from '@app/core/services/auth/auth';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import { CollaboratorsSheetComponent } from '@shared/ui/collaborators-sheet/collaborators-sheet';
import { createCollaborationState } from '@shared/utils/collaboration-state';
import { VersusService } from '@app/core/services/versus/versus';
import { AdultGateService } from '@app/core/services/adult-gate/adult-gate';
import type {
  StartVersusSessionResponse,
  VersusEntry,
  VersusMediaRankingEntry,
  VersusPoolResponse,
} from '@app/core/services/versus/versus.model';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { TranslateService } from '@app/core/services/translate/translate';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { EmptyStateComponent } from '@shared/ui/empty-state/empty-state';
import { MediaHeaderComponent } from '@shared/ui/media-header/media-header';
import { TabsComponent } from '@shared/ui/tabs/tabs';
import { featuredMediaBackdropUrl } from '@shared/utils/media-backdrop.util';
import type { TabItem } from '@shared/ui/tabs/tabs';
import type { UnsavedChangesAware } from '@app/core/guards/unsaved-changes-guard';
import { createVersusEditState, MIN_VERSUS_ENTRIES } from '../state/versus-edit-state';
import { ClipSheetComponent } from '../ui/clip-sheet/clip-sheet';
import { AvatarComponent } from '@shared/ui/avatar/avatar';
import { CollabInviteBannerComponent } from '@shared/ui/collab-invite-banner/collab-invite-banner';
import { PageFooterComponent } from '@shared/ui/page-footer/page-footer';
import { AdultBadgeComponent } from '@shared/ui/adult-badge/adult-badge';
import { MediaPickerComponent } from '@shared/ui/media-picker/media-picker';
import { PublishDialogComponent } from '@shared/ui/publish-dialog/publish-dialog';
import type { CollectionVisibility } from '@app/core/services/auth/auth.model';
import type { SearchResult } from '@app/core/services/search/search.model';
import { EntityMediaGridComponent } from '@app/features/entity/ui/entity-media-grid';
import { toPlaceholderCollectionItem } from '@shared/utils/media-placeholder-item.util';
import { VersusEntryCardComponent } from '../ui/versus-entry-card/versus-entry-card';
import {
  BULK_BAR,
  CHECKBOX,
  CHECKBOX_OFF,
  CHECKBOX_ON,
  MEDIA_CHIP,
  SECTION_TITLE,
  staggerDelay,
} from '@shared/ui/ui-recipes';
import { IconComponent } from '@shared/ui/icon/icon';
import { VersusResultsComponent } from '../ui/versus-results/versus-results';
import { DetailSkeletonComponent } from '@shared/ui/detail-skeleton/detail-skeleton';
import { CommentsComponent } from '@shared/ui/comments/comments';
import type { CommentsSource } from '@shared/ui/comments/comments.model';
import {
  creationVisibilityInfo,
  isSharedCreation,
  dropLegacyEditParam,
  focusCreationTitle,
} from '@shared/utils/creation-page.util';
import { ButtonComponent, buttonClasses } from '@shared/ui/button/button';
import { ClipVolumeComponent } from '../ui/clip-player/clip-volume';
import { SelectionToggleComponent } from '@shared/ui/selection-toggle/selection-toggle';
import { SelectionRemoveComponent } from '@shared/ui/selection-remove/selection-remove';

@Component({
  selector: 'shelfy-versus-pool-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SelectionToggleComponent,
    SelectionRemoveComponent,
    TranslatePipe,
    EmptyStateComponent,
    VersusEntryCardComponent,
    EntityMediaGridComponent,
    ClipVolumeComponent,
    MediaHeaderComponent,
    TabsComponent,
    AdultBadgeComponent,
    CollaboratorsSheetComponent,
    RouterLink,
    ClipSheetComponent,
    AvatarComponent,
    CollabInviteBannerComponent,
    PageFooterComponent,
    MediaPickerComponent,
    PublishDialogComponent,
    IconComponent,
    VersusResultsComponent,
    DetailSkeletonComponent,
    CommentsComponent,
    ButtonComponent,
  ],
  templateUrl: './versus-pool-detail.html',
})
export class VersusPoolDetailPageComponent implements UnsavedChangesAware {
  private readonly versusService = inject(VersusService);
  private readonly toastService = inject(ToastService);
  private readonly errorMessage = inject(ErrorMessageService);
  private readonly translate = inject(TranslateService);
  private readonly dateFormat = inject(DateFormatService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly adultGate = inject(AdultGateService);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  readonly signedIn = this.auth.isAuthenticated;
  private readonly poolId = this.route.snapshot.paramMap.get('poolId') ?? '';

  protected readonly sectionTitle = SECTION_TITLE;
  readonly bulkBar = BULK_BAR;
  readonly checkbox = CHECKBOX;
  readonly checkboxOn = CHECKBOX_ON;
  readonly checkboxOff = CHECKBOX_OFF;
  readonly mediaChip = MEDIA_CHIP;
  readonly minEntries = MIN_VERSUS_ENTRIES;
  readonly unfinished = signal<StartVersusSessionResponse | null>(null);
  private readonly fresh = !!this.router.currentNavigation()?.extras.state?.['fresh'];
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly stagger = staggerDelay;

  readonly pool = signal<VersusPoolResponse | null>(null);
  readonly edit = createVersusEditState(this.pool);
  readonly publishOpen = signal(false);
  readonly mediaPickerOpen = signal(false);
  readonly clipSheet = signal<{ entry: VersusEntry | null } | null>(null);
  readonly ctaKind = computed<'publish' | 'resume' | 'play' | 'add' | 'like'>(() => {
    const pool = this.pool();
    if (!pool) return 'like';
    const draft = pool.isOwner && pool.visibility === 'private' && !isSharedCreation(pool);
    if (draft && this.edit.enoughEntries()) return 'publish';
    if (this.unfinished()) return 'resume';
    if (this.edit.enoughEntries()) return 'play';
    return pool.canEdit ? 'add' : 'like';
  });
  readonly addLabel = computed(() =>
    this.edit.kind() === 'clips' ? 'versus.manage.add_clips' : 'lists.manage.add_titles',
  );
  readonly pickedMedia = computed(() =>
    this.edit.entries().flatMap((entry) => (entry.media && !entry.clip ? [entry.media] : [])),
  );
  readonly mediaItems = computed(() =>
    this.pickedMedia().map((media) => toPlaceholderCollectionItem(media)),
  );
  private readonly entryByMedia = computed(
    () =>
      new Map(
        this.edit
          .entries()
          .flatMap((entry) =>
            entry.media && !entry.clip ? [[entry.media.id, entry] as const] : [],
          ),
      ),
  );
  readonly selectedMediaIds = computed(
    () =>
      new Set(
        this.edit
          .entries()
          .flatMap((entry) =>
            entry.media && this.edit.selected().has(entry.id) ? [entry.media.id] : [],
          ),
      ),
  );
  readonly selectedIds = computed(() => {
    const picked = this.edit.selected();
    return this.edit
      .entries()
      .map((entry) => entry.id)
      .filter((id) => picked.has(id));
  });
  readonly allSelected = computed(
    () =>
      this.edit.entries().length > 0 && this.selectedIds().length === this.edit.entries().length,
  );
  readonly saveStatus = computed(() => {
    this.translate.lang();
    if (!this.pool()?.canEdit) return null;
    if (this.edit.detailsState() === 'error') return this.translate.get('lists.manage.not_saved');
    if (this.edit.saving()) return this.translate.get('edit.autosaving');
    return this.edit.detailsState() === 'saved' ? this.translate.get('edit.saved') : null;
  });
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly starting = signal(false);
  readonly liking = signal(false);
  readonly results = signal<VersusMediaRankingEntry[] | null>(null);
  readonly resultsLoading = signal(true);

  readonly commentTotal = signal<number | null>(null);
  readonly updatedLabel = computed(() => {
    this.translate.lang();
    const pool = this.pool();
    if (!pool || pool.updatedAt === pool.createdAt) return null;
    const date = new Date(pool.updatedAt);
    if (Number.isNaN(date.getTime())) return null;
    return this.translate.get('versus.detail.edited_ago', {
      when: this.dateFormat.formatRelative(date, this.translate.lang()),
    });
  });
  readonly visibilityInfo = computed(() =>
    creationVisibilityInfo(this.pool()?.visibility, isSharedCreation(this.pool())),
  );
  readonly isShared = computed(() => isSharedCreation(this.pool()));

  readonly heroMeta = computed(() => {
    this.translate.lang();
    const pool = this.pool();
    if (!pool) return [];
    const visibility =
      pool.visibility === 'public'
        ? []
        : [
            this.translate.get(
              pool.isOwner && pool.visibility === 'private' && !isSharedCreation(pool)
                ? 'lists.manage.draft'
                : this.visibilityInfo().labelKey,
            ),
          ];
    const status = this.saveStatus();
    return [
      this.translate.get('versus.detail.item_count', { count: this.edit.entries().length }),
      ...visibility,
      ...(status ? [status] : this.updatedLabel() ? [this.updatedLabel()!] : []),
    ];
  });

  readonly isPendingInvite = computed(() => this.pool()?.viewerCollaboratorStatus === 'PENDING');
  readonly isCollaborator = computed(
    () => this.pool()?.viewerCollaboratorStatus === 'ACCEPTED' && !this.pool()?.isOwner,
  );
  readonly collab = createCollaborationState({
    target: this.pool,
    viewerId: computed(() => this.auth.currentUser()?.id ?? null),
    api: {
      invite: (id, userId) => this.versusService.inviteCollaborator(id, userId),
      accept: (id) => this.versusService.acceptCollaboratorInvite(id),
      decline: (id) => this.versusService.declineCollaboratorInvite(id),
      remove: (id, userId) => this.versusService.removeCollaborator(id, userId),
    },
    changed: () => this.loadPool(),
    gone: () => void this.router.navigateByUrl('/creations?f=versus', { replaceUrl: true }),
  });
  readonly likeTotal = computed(() => this.pool()?.likeCount ?? 0);
  readonly artCovers = computed(() => {
    const entries = this.edit.entries();
    return entries.slice(0, 4).map((entry) => ({
      id: entry.id,
      title: entry.title,
      coverUrl: entry.coverUrl,
      adult: !!entry.media?.isAdult,
    }));
  });
  readonly coAuthors = computed(() => this.pool()?.collaborators ?? []);
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
    featuredMediaBackdropUrl(
      this.edit
        .entries()
        .flatMap((entry) => (entry.media && !entry.media.isAdult ? [entry.media] : [])),
    ),
  );

  readonly hasClip = computed(() => !!this.pool()?.entries.some((entry) => entry.clip));
  readonly tab = signal<'entries' | 'ranking' | 'discussion'>(
    pageTab(this.route.snapshot.queryParamMap.get('tab')),
  );
  readonly pageTabs = computed<TabItem[]>(() => {
    this.translate.lang();
    const pool = this.pool();
    return [
      {
        id: 'entries',
        label: this.translate.get('community.versus.entries'),
        count: pool ? this.edit.entries().length : null,
      },
      { id: 'ranking', label: this.translate.get('creation.tabs.ranking') },
      {
        id: 'discussion',
        label: this.translate.get('creation.tabs.discussion'),
        count: this.commentTotal() ?? pool?.commentCount ?? null,
      },
    ];
  });
  constructor() {
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
      if (this.pool() && this.fresh) untracked(() => setTimeout(() => this.focusFreshTitle()));
    });
    destroyRef.onDestroy(() => this.dropUntouchedDraft());
    this.loadPool();
    this.loadResults();
    if (this.signedIn()) {
      this.versusService.currentSession(this.poolId).subscribe({
        next: (session) => this.unfinished.set(session),
        error: () => this.unfinished.set(null),
      });
    }
  }

  private loadPool(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.versusService.getPool(this.poolId).subscribe({
      next: (pool) => {
        this.pool.set(pool);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.failed.set(true);
        this.loading.set(false);
        catchAndToastError(this.toastService, this.errorMessage)(error);
      },
    });
  }

  private loadResults(): void {
    this.resultsLoading.set(true);
    this.versusService.getResults(this.poolId).subscribe({
      next: (response) => {
        this.results.set(response.ranking);
        this.resultsLoading.set(false);
      },
      error: (error: unknown) => {
        this.resultsLoading.set(false);
        catchAndToastError(this.toastService, this.errorMessage)(error);
      },
    });
  }

  hasUnsavedChanges(): boolean {
    return this.edit.hasUnsaved();
  }

  private focusFreshTitle(): void {
    if (!this.fresh || !this.pool()?.isOwner) return;
    focusCreationTitle(this.host.nativeElement);
  }

  private dropUntouchedDraft(): void {
    const pool = this.pool();
    const untouched =
      this.fresh &&
      !!pool?.isOwner &&
      pool.visibility === 'private' &&
      this.edit.entries().length === 0 &&
      this.edit.name().trim() === this.translate.get('studio.untitled_versus') &&
      !this.edit.description().trim() &&
      pool.collaborators.length === 0 &&
      pool.pendingInvites.length === 0;
    if (untouched) this.versusService.deletePool(pool.id).subscribe({ error: () => undefined });
  }

  publish(visibility: CollectionVisibility): void {
    this.publishOpen.set(false);
    this.edit.publish(visibility);
  }

  openAdd(): void {
    if (this.edit.kind() === 'clips') this.openClipSheet(null);
    else this.mediaPickerOpen.set(true);
  }

  openClipSheet(entry: VersusEntry | null): void {
    this.clipSheet.set({ entry });
  }

  selectAll(): void {
    this.edit.selectAll(this.edit.entries().map((entry) => entry.id));
  }

  removeByKey(item: SearchResult): void {
    const key = `${item.provider}:${item.mediaType}:${item.externalId}`;
    const entry = this.edit
      .entries()
      .find(
        (e) =>
          !e.clip &&
          !!e.media &&
          `${e.media.provider}:${e.media.mediaType}:${e.media.externalId}` === key,
      );
    if (entry) this.edit.remove([entry.id]);
  }

  async deletePool(): Promise<void> {
    const pool = this.pool();
    if (!pool) return;
    const confirmed = await this.confirm.ask(
      this.translate.get('studio.delete_versus_message', { name: pool.name }),
      {
        title: this.translate.get('studio.delete_versus_title'),
        confirmLabel: this.translate.get('studio.delete'),
        destructive: true,
      },
    );
    if (!confirmed) return;
    this.versusService.deletePool(pool.id).subscribe({
      complete: () => {
        this.toastService.success(this.translate.get('studio.versus_deleted'));
        void this.router.navigateByUrl('/creations?f=versus&scope=MINE', { replaceUrl: true });
      },
      error: catchAndToastError(this.toastService, this.errorMessage),
    });
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
    this.loadPool();
    this.loadResults();
  }

  entryFor(mediaId: string): VersusEntry | undefined {
    return this.entryByMedia().get(mediaId);
  }

  toggleMedia(mediaId: string): void {
    const entry = this.entryFor(mediaId);
    if (entry) this.edit.toggleSelected(entry.id);
  }

  openMedia(mediaId: string): void {
    const entry = this.entryFor(mediaId);
    if (entry) this.open(entry);
  }

  open(entry: VersusEntry): void {
    const media = entry.media;
    if (media?.isAdult && !media.title) {
      void this.adultGate.open();
      return;
    }
    if (media) void this.router.navigate(['/media', media.mediaType, media.externalId]);
  }

  toggleLike(): void {
    const pool = this.pool();
    if (!pool || pool.canEdit || this.liking()) return;
    const liked = !pool.isLikedByViewer;
    this.pool.set({
      ...pool,
      isLikedByViewer: liked,
      likeCount: pool.likeCount + (liked ? 1 : -1),
    });
    this.liking.set(true);
    const request = liked ? this.versusService.like(pool.id) : this.versusService.unlike(pool.id);
    request.subscribe({
      next: (updated) => {
        this.pool.set(updated);
        this.liking.set(false);
      },
      error: (error: unknown) => {
        this.pool.set(pool);
        this.liking.set(false);
        catchAndToastError(this.toastService, this.errorMessage)(error);
      },
    });
  }
  commentsSource(poolId: string): CommentsSource {
    return {
      list: (page, size, sort) => this.versusService.comments(poolId, page, size, sort),
      add: (content, parentCommentId) =>
        this.versusService.comment(poolId, content, parentCommentId),
      update: (commentId, content) => this.versusService.updateComment(poolId, commentId, content),
      remove: (commentId) => this.versusService.deleteComment(poolId, commentId),
      vote: (commentId, value) => this.versusService.voteComment(poolId, commentId, value),
      removeVote: (commentId) => this.versusService.removeCommentVote(poolId, commentId),
    };
  }

  play(): void {
    this.starting.set(true);
    this.versusService.startSession(this.poolId).subscribe({
      next: (session) => {
        this.starting.set(false);
        this.router.navigate(['/versus', this.poolId, 'play', session.sessionId]);
      },
      error: (error: unknown) => {
        this.starting.set(false);
        catchAndToastError(this.toastService, this.errorMessage)(error);
      },
    });
  }

  selectTab(id: string): void {
    const next = pageTab(id);
    this.tab.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: next === 'entries' ? null : next },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}

function pageTab(id: string | null): 'entries' | 'ranking' | 'discussion' {
  return id === 'ranking' || id === 'discussion' ? id : 'entries';
}
