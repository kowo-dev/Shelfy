import { BackLinkComponent } from '@shared/ui/back-link/back-link';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@app/core/services/auth/auth';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import type {
  VersusFollowedSession,
  VersusSessionResult,
} from '@app/core/services/versus/versus.model';
import { VersusService } from '@app/core/services/versus/versus';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { AvatarComponent } from '@shared/ui/avatar/avatar';
import { buttonClasses } from '@shared/ui/button/button';
import { PageHeroComponent } from '@shared/ui/page-hero/page-hero';
import { PageFooterComponent } from '@shared/ui/page-footer/page-footer';
import { ShelfSectionComponent } from '@shared/ui/shelf-section/shelf-section';
import { toPlaceholderCollectionItem } from '@shared/utils/media-placeholder-item.util';
import type { MediaResponse } from '@app/core/services/collection/collection.model';
import { MediaCardComponent } from '@shared/ui/media-card/media-card';
import { featuredMediaBackdropUrl } from '@shared/utils/media-backdrop.util';
import { DetailSkeletonComponent } from '@shared/ui/detail-skeleton/detail-skeleton';
import { EmptyStateComponent } from '@shared/ui/empty-state/empty-state';
import { IconComponent } from '@shared/ui/icon/icon';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { copyPageLink } from '@shared/utils/copy-link.util';
import { renderPodiumCard } from '../data-access/podium-card';
import { VersusPodiumComponent } from '../ui/versus-podium/versus-podium';

@Component({
  selector: 'shelfy-versus-result-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BackLinkComponent,
    RouterLink,
    TranslatePipe,
    AvatarComponent,
    PageHeroComponent,
    PageFooterComponent,
    DetailSkeletonComponent,
    EmptyStateComponent,
    IconComponent,
    VersusPodiumComponent,
    ShelfSectionComponent,
    MediaCardComponent,
  ],
  templateUrl: './versus-result.html',
})
export class VersusResultPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly versus = inject(VersusService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly dateFormat = inject(DateFormatService);
  private readonly onError = catchAndToastError(this.toast, inject(ErrorMessageService));

  readonly primaryPill = buttonClasses({ variant: 'primary', extraClass: 'gap-2.5' });
  readonly secondaryPill = buttonClasses({ variant: 'secondary', extraClass: 'gap-2.5' });
  protected readonly manage =
    'text-text-subtle hover:text-text inline-flex h-9 cursor-pointer items-center gap-1.5 text-sm font-semibold transition-colors disabled:opacity-50';
  protected readonly placeholder = (media: MediaResponse) => toPlaceholderCollectionItem(media);
  readonly signedIn = this.auth.isAuthenticated;

  readonly poolId = this.route.snapshot.paramMap.get('poolId') ?? '';
  private readonly sessionId = this.route.snapshot.paramMap.get('sessionId') ?? '';

  readonly result = signal<VersusSessionResult | null>(null);
  readonly failed = signal(false);
  readonly friends = signal<VersusFollowedSession[]>([]);
  readonly friend = signal<VersusSessionResult | null>(null);
  readonly friendLoading = signal<string | null>(null);
  readonly rendering = signal(false);
  readonly starting = signal(false);

  readonly isMine = computed(
    () => this.result()?.player.username === this.auth.currentUser()?.username,
  );
  readonly playerName = computed(() => {
    const player = this.result()?.player;
    return player?.displayName || player?.username || '';
  });
  readonly meta = computed(() => {
    this.translate.lang();
    const result = this.result();
    if (!result) return [];
    const date = new Date(result.completedAt);
    return [
      this.translate.get('versus.result.byline', { name: this.playerName() }),
      this.translate.get('versus.detail.item_count', { count: result.entryCount }),
      ...(Number.isNaN(date.getTime())
        ? []
        : [this.dateFormat.formatRelative(date, this.translate.lang())]),
    ];
  });
  readonly winnerBackdrop = computed(() => {
    const podium = this.result()?.podium ?? [];
    const ordered = [...podium].sort((a, b) => a.place - b.place);
    return featuredMediaBackdropUrl(
      ordered.flatMap((entry) =>
        entry.entry.media && !entry.entry.media.isAdult ? [entry.entry.media] : [],
      ),
    );
  });
  readonly sharedCount = computed(() => {
    const result = this.result();
    return result ? Math.round((result.agreement * result.podium.length) / 100) : 0;
  });
  readonly firstGame = computed(() => (this.result()?.communitySessionCount ?? 0) <= 1);

  constructor() {
    this.versus.sessionResult(this.sessionId).subscribe({
      next: (result) => this.result.set(result),
      error: (error: unknown) => {
        this.failed.set(true);
        this.onError(error);
      },
    });
    if (this.signedIn()) {
      this.versus.followedSessions(this.poolId).subscribe({
        next: (sessions) => this.friends.set(sessions),
        error: () => this.friends.set([]),
      });
    }
  }

  playedLabel(completedAt: string): string {
    this.translate.lang();
    const date = new Date(completedAt);
    return Number.isNaN(date.getTime())
      ? ''
      : this.dateFormat.formatRelative(date, this.translate.lang());
  }

  compareWith(session: VersusFollowedSession): void {
    if (this.friend()?.sessionId === session.sessionId) {
      this.friend.set(null);
      return;
    }
    this.friendLoading.set(session.sessionId);
    this.versus.sessionResult(session.sessionId).subscribe({
      next: (result) => {
        this.friendLoading.set(null);
        this.friend.set(result);
      },
      error: (error: unknown) => {
        this.friendLoading.set(null);
        this.onError(error);
      },
    });
  }

  playAgain(): void {
    if (this.starting()) return;
    this.starting.set(true);
    this.versus.startSession(this.poolId).subscribe({
      next: (session) =>
        void this.router.navigate(['/versus', this.poolId, 'play', session.sessionId]),
      error: (error: unknown) => {
        this.starting.set(false);
        this.onError(error);
      },
    });
  }

  copyLink(): void {
    void copyPageLink(this.toast, this.translate);
  }

  async downloadCard(): Promise<void> {
    const result = this.result();
    if (!result || this.rendering()) return;
    this.rendering.set(true);
    try {
      const blob = await renderPodiumCard(result, {
        byline: this.translate.get('versus.result.byline', { name: this.playerName() }),
        places: {
          1: this.translate.get('versus.result.place_1'),
          2: this.translate.get('versus.result.place_2'),
          3: this.translate.get('versus.result.place_3'),
        },
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${result.poolName.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}-podium.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      this.toast.error(this.translate.get('versus.result.card_failed'));
    } finally {
      this.rendering.set(false);
    }
  }
}
