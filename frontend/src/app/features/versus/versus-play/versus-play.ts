import { buttonClasses } from '@shared/ui/button/button';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AmbientService } from '@app/core/services/ambient/ambient';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { LayoutService } from '@app/core/services/layout/layout';
import { ToastService } from '@app/core/services/toast/toast';
import type { VersusMatchResponse } from '@app/core/services/versus/versus.model';
import { VersusService } from '@app/core/services/versus/versus';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import { SideSheetComponent } from '@shared/ui/side-sheet/side-sheet';
import { SpinnerComponent } from '@shared/ui/spinner/spinner';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { createVersusSessionState, type VersusSessionState } from '../state/versus-session-state';
import { VersusBracketMapComponent } from '../ui/versus-bracket-map/versus-bracket-map';
import { VersusBracketProgressComponent } from '../ui/versus-bracket-progress/versus-bracket-progress';
import { VersusMatchupComponent } from '../ui/versus-matchup/versus-matchup';
import { ClipVolumeComponent } from '../ui/clip-player/clip-volume';

@Component({
  selector: 'shelfy-versus-play',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    RouterLink,
    IconComponent,
    SideSheetComponent,
    SpinnerComponent,
    VersusMatchupComponent,
    ClipVolumeComponent,
    VersusBracketProgressComponent,
    VersusBracketMapComponent,
  ],
  templateUrl: './versus-play.html',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class VersusPlayPageComponent {
  private readonly versusService = inject(VersusService);
  private readonly toastService = inject(ToastService);
  private readonly errorMessage = inject(ErrorMessageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ambient = inject(AmbientService);
  private readonly layout = inject(LayoutService);
  private readonly onError = catchAndToastError(this.toastService, this.errorMessage);

  readonly textAction =
    'text-text-muted hover:text-text inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 justify-self-start text-[0.9375rem] font-semibold transition-colors';
  readonly undoButton = buttonClasses({ variant: 'secondary', size: 'sm', iconOnly: true });
  readonly kbd =
    'text-text inline-grid h-7 min-w-7 place-items-center rounded-lg bg-white/8 px-1.5 font-sans text-[0.8125rem] font-bold';
  readonly hoverCover = signal<string | null>(null);
  readonly bracketOpen = signal(false);
  readonly bracket = signal<VersusMatchResponse[] | null>(null);

  readonly state: VersusSessionState = createVersusSessionState(this.versusService, this.onError);
  readonly hasClips = computed(() => {
    const match = this.state.currentMatch();
    return !!(match?.entryA?.clip || match?.entryB?.clip);
  });

  constructor() {
    this.layout.navOverlay.set(true);
    this.layout.immersive.set(true);
    effect(() => {
      const cover = this.hoverCover();
      if (cover) void this.ambient.follow(cover);
      else this.ambient.tint(null);
    });
    effect(() => {
      const sessionId = this.state.completed() ? this.state.sessionId() : null;
      const poolId = this.state.poolId();
      if (sessionId && poolId) {
        void this.router.navigate(['/versus', poolId, 'results', sessionId], { replaceUrl: true });
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.ambient.tint(null);
      this.layout.navOverlay.set(false);
      this.layout.immersive.set(false);
    });
    const poolId = this.route.snapshot.paramMap.get('poolId');
    const sessionId = this.route.snapshot.paramMap.get('sessionId');
    if (sessionId) {
      this.state.resume(sessionId);
    } else if (poolId) {
      this.state.start(poolId);
    }
  }

  pick(entryId: string): void {
    this.state.pick(entryId);
  }

  undo(): void {
    if (this.state.canUndo()) this.state.undo();
  }

  openBracket(): void {
    const sessionId = this.state.sessionId();
    if (!sessionId) return;
    this.bracketOpen.set(true);
    this.versusService.getBracket(sessionId).subscribe({
      next: (matches) => this.bracket.set(matches),
      error: this.onError,
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey || this.bracketOpen()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, [contenteditable="true"]')) return;
    if (event.key === 'Backspace' || event.key === 'z') {
      event.preventDefault();
      this.undo();
    }
  }

  poolUrl(): string[] {
    return ['/versus', this.state.poolId() ?? this.route.snapshot.paramMap.get('poolId') ?? ''];
  }
}
