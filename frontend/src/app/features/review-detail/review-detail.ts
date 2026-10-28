import { BackLinkComponent } from '@shared/ui/back-link/back-link';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  type ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, startWith, switchMap } from 'rxjs';
import { UserProfileService } from '@app/core/services/users/user-profile';
import { AdultGateService } from '@app/core/services/adult-gate/adult-gate';
import { AuthService } from '@app/core/services/auth/auth';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { TranslateService } from '@app/core/services/translate/translate';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { MediaHeaderComponent } from '@shared/ui/media-header/media-header';
import { RatingSliderComponent } from '@shared/ui/rating-slider/rating-slider';
import { PageFooterComponent } from '@shared/ui/page-footer/page-footer';
import {
  formatRating,
  ratingToTextColor,
  ratingVerdictKey,
} from '@shared/utils/collection-rating.util';
import { ImageLightboxComponent } from '@shared/ui/image-lightbox/image-lightbox';
import { AdultBadgeComponent } from '@shared/ui/adult-badge/adult-badge';
import { AvatarComponent } from '@shared/ui/avatar/avatar';
import { DetailSkeletonComponent } from '@shared/ui/detail-skeleton/detail-skeleton';
import { IconComponent } from '@shared/ui/icon/icon';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { CommentsComponent } from '@shared/ui/comments/comments';
import type { CommentsSource } from '@shared/ui/comments/comments.model';
import { SpoilerGuardComponent } from '@shared/ui/spoiler-guard/spoiler-guard';
import { ReviewCommentsService } from '@app/core/services/reviews/review-comments';
import { RichTextViewComponent } from '@shared/ui/rich-text/rich-text-view';
import { richTextExcerpt, SPOILER_MASK } from '@shared/utils/rich-text.util';
import { PANEL_BUTTON } from '@shared/ui/ui-recipes';
import { buttonClasses } from '@shared/ui/button/button';
import { TabsComponent, type TabItem } from '@shared/ui/tabs/tabs';
import { WatchLogTimelineComponent } from '@shared/ui/watch-log/watch-log-timeline';
import type { WatchLogEntry } from '@app/core/services/watch-log/watch-log.model';
import { mediaLogKind } from '@shared/utils/media-log-kind.util';

@Component({
  selector: 'shelfy-review-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BackLinkComponent,
    AdultBadgeComponent,
    AvatarComponent,
    RichTextViewComponent,
    MediaHeaderComponent,
    RatingSliderComponent,
    PageFooterComponent,
    ImageLightboxComponent,
    DetailSkeletonComponent,
    IconComponent,
    RouterLink,
    TranslatePipe,
    CommentsComponent,
    SpoilerGuardComponent,
    WatchLogTimelineComponent,
    TabsComponent,
  ],
  templateUrl: './review-detail.html',
})
export class ReviewDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly profiles = inject(UserProfileService);
  private readonly auth = inject(AuthService);
  private readonly reviewComments = inject(ReviewCommentsService);
  private readonly toast = inject(ToastService);
  private readonly errorMessage = inject(ErrorMessageService);
  private readonly dateFormat = inject(DateFormatService);
  private readonly translate = inject(TranslateService);
  private readonly adultGate = inject(AdultGateService);
  readonly posterOpen = signal(false);
  protected readonly softButton = PANEL_BUTTON;
  protected readonly primaryButton = buttonClasses({ variant: 'primary', extraClass: 'gap-2.5' });
  protected readonly social =
    'text-text hover:text-text-muted inline-flex h-11 cursor-pointer items-center gap-2 text-base font-semibold transition-colors disabled:opacity-50';
  private readonly barSentinel = viewChild<ElementRef<HTMLElement>>('barSentinel');
  readonly stuck = signal(false);

  openAdultGate(): void {
    void this.adultGate.open();
  }
  readonly authorName = computed(() => {
    const review = this.review();
    return review ? review.displayName || review.username : '';
  });

  readonly review = toSignal(
    this.route.paramMap.pipe(switchMap((params) => this.profiles.getReview(params.get('id')!))),
    { initialValue: null },
  );

  readonly viewings = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) =>
        this.profiles.getReviewWatchLog(params.get('id')!).pipe(
          catchError(() => of([])),
          startWith([] as WatchLogEntry[]),
        ),
      ),
    ),
    { initialValue: [] },
  );
  readonly viewingKind = computed(() => {
    const review = this.review();
    return review ? mediaLogKind(review.media.mediaType) : 'watch';
  });

  readonly liking = signal(false);
  private readonly likeState = signal<{ id: string; liked: boolean; count: number } | null>(null);
  readonly liked = computed(() => {
    const review = this.review();
    const state = this.likeState();
    return state && state.id === review?.id ? state.liked : (review?.isLikedByViewer ?? false);
  });
  readonly likeCount = computed(() => {
    const review = this.review();
    const state = this.likeState();
    return state && state.id === review?.id ? state.count : (review?.likeCount ?? 0);
  });

  readonly createdAtLabel = computed(() => {
    this.translate.lang();
    const raw = this.review()?.createdAt;
    const date = raw ? new Date(raw) : null;
    return date && !Number.isNaN(date.getTime())
      ? this.dateFormat.formatDate(date, this.translate.lang())
      : '';
  });
  readonly updatedAtLabel = computed(() => this.formatDate(this.review()?.updatedAt));
  readonly showUpdatedAt = computed(() => {
    const review = this.review();
    return !!review && review.updatedAt !== review.createdAt;
  });

  readonly pullQuote = computed(() => {
    const review = this.review();
    if (!review || review.containsSpoilers) return null;
    const text = richTextExcerpt(review.content, 2000);
    if (text.includes(SPOILER_MASK)) return null;
    if (text.length < 160) return null;
    const sentence = /^.{40,180}?[.!?…](?=\s|$)/.exec(text)?.[0];
    return sentence ?? richTextExcerpt(review.content, 140);
  });

  readonly commentTotal = signal<number | null>(null);
  readonly commentCount = computed(() => this.commentTotal() ?? this.review()?.commentCount ?? 0);
  readonly mediaRoute = computed(() => {
    const media = this.review()?.media;
    return media ? ['/media', media.mediaType, media.externalId] : ['/creations'];
  });
  readonly ratingText = computed(() => {
    const rating = this.review()?.rating;
    return rating === null || rating === undefined ? '' : formatRating(rating);
  });
  readonly ratingColor = computed(() => {
    const rating = this.review()?.rating;
    return rating === null || rating === undefined ? null : ratingToTextColor(rating, 55);
  });
  readonly verdictKey = computed(() => ratingVerdictKey(this.review()?.rating ?? null));

  readonly heroBackdrop = computed(() => {
    const backdrop = this.review()?.media.metadata?.['backdropUrl'];
    return typeof backdrop === 'string' && backdrop ? backdrop : null;
  });

  readonly mediaMeta = computed(() => {
    this.translate.lang();
    const media = this.review()?.media;
    if (!media) return '';
    const release = media.metadata?.['releaseDate'] ?? media.metadata?.['releaseYear'];
    const year =
      typeof release === 'string' || typeof release === 'number'
        ? String(release).slice(0, 4)
        : null;
    return [this.translate.get('collection.media_type_one.' + media.mediaType), year]
      .filter(Boolean)
      .join(' · ');
  });

  readonly startsAtComments =
    this.route.snapshot.queryParamMap.get('tab') === 'discussion' ||
    this.route.snapshot.fragment === 'comments';
  readonly tab = signal<'review' | 'viewings' | 'discussion'>(
    this.startsAtComments
      ? 'discussion'
      : this.route.snapshot.queryParamMap.get('tab') === 'viewings'
        ? 'viewings'
        : 'review',
  );
  readonly pageTabs = computed<TabItem[]>(() => {
    this.translate.lang();
    const viewings = this.viewings().length;
    return [
      { id: 'review', label: this.translate.get('creation.tabs.review') },
      ...(viewings > 0 || this.tab() === 'viewings'
        ? [
            {
              id: 'viewings',
              label: this.translate.get('review.viewings.' + this.viewingKind()),
              count: viewings,
            },
          ]
        : []),
      {
        id: 'discussion',
        label: this.translate.get('creation.tabs.discussion'),
        count: this.commentCount(),
      },
    ];
  });

  constructor() {
    let jumped = false;
    effect(() => {
      if (jumped || !this.startsAtComments || !this.review()) return;
      jumped = true;
      setTimeout(() => this.scrollToBar());
    });
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const scroller = document.querySelector('.app-main') ?? window;
      const onScroll = () => this.measureBar();
      scroller.addEventListener('scroll', onScroll, { passive: true });
      destroyRef.onDestroy(() => scroller.removeEventListener('scroll', onScroll));
    });
  }

  selectTab(id: string): void {
    const next = id === 'discussion' || id === 'viewings' ? id : 'review';
    this.tab.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: next === 'review' ? null : next },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  goToComments(): void {
    this.selectTab('discussion');
    this.scrollToBar();
  }

  private scrollToBar(): void {
    this.barSentinel()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  isMine(userId: string | undefined): boolean {
    return !!userId && userId === this.auth.currentUser()?.id;
  }

  private formatDate(raw: string | undefined): string {
    this.translate.lang();
    if (!raw) return '';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '';
    return this.dateFormat.formatDateTime(date, this.translate.lang());
  }

  toggleLike(): void {
    const review = this.review();
    if (!review || this.liking()) return;
    const previous = this.likeState();
    const liked = !this.liked();
    this.likeState.set({ id: review.id, liked, count: this.likeCount() + (liked ? 1 : -1) });
    this.liking.set(true);
    const request = liked
      ? this.profiles.likeReview(review.id)
      : this.profiles.unlikeReview(review.id);
    request.subscribe({
      next: () => this.liking.set(false),
      error: (error: unknown) => {
        this.liking.set(false);
        this.likeState.set(previous);
        catchAndToastError(this.toast, this.errorMessage)(error);
      },
    });
  }

  commentsSource(reviewId: string): CommentsSource {
    return {
      list: (page, size, sort) => this.reviewComments.comments(reviewId, page, size, sort),
      add: (content, parentCommentId) =>
        this.reviewComments.comment(reviewId, content, parentCommentId),
      update: (commentId, content) =>
        this.reviewComments.updateComment(reviewId, commentId, content),
      remove: (commentId) => this.reviewComments.deleteComment(reviewId, commentId),
      vote: (commentId, value) => this.reviewComments.voteComment(reviewId, commentId, value),
      removeVote: (commentId) => this.reviewComments.removeCommentVote(reviewId, commentId),
    };
  }
}
