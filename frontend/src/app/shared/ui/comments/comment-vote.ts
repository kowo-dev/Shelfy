import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import { displayScore } from './comment-score';
import type { CommentVoteValue } from './comments.model';

@Component({
  selector: 'shelfy-comment-vote',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TranslatePipe],
  template: `
    <div
      class="flex items-center gap-0.5 transition-opacity"
      [class.opacity-60]="pending()"
      [attr.aria-busy]="pending() || null"
    >
      <button
        type="button"
        [class]="voteButton"
        [class.text-accent]="myVote() === 1"
        [class.text-text-subtle]="myVote() !== 1"
        [class.animate-vote-shake]="shake() === 1"
        [disabled]="disabled()"
        [attr.aria-pressed]="myVote() === 1"
        [attr.aria-label]="'comments.vote.up' | translate"
        (click)="toggle(1)"
      >
        <shelfy-icon name="thumbsUp" size="sm" [active]="myVote() === 1" />
      </button>
      @if (scoreLabel(); as label) {
        <span class="grid min-w-[2ch] overflow-hidden text-center">
          @for (value of [label]; track value) {
            <span
              class="col-start-1 row-start-1 text-sm font-semibold tabular-nums"
              [class]="myVote() === 1 ? 'text-accent' : 'text-text-muted'"
              animate.enter="animate-count-in"
              >{{ value }}</span
            >
          }
        </span>
      }
      <button
        type="button"
        [class]="voteButton"
        [class.text-accent]="myVote() === -1"
        [class.text-text-subtle]="myVote() !== -1"
        [class.animate-vote-shake]="shake() === -1"
        [disabled]="disabled()"
        [attr.aria-pressed]="myVote() === -1"
        [attr.aria-label]="'comments.vote.down' | translate"
        (click)="toggle(-1)"
      >
        <shelfy-icon name="thumbsDown" size="sm" [active]="myVote() === -1" />
      </button>
    </div>
  `,
})
export class CommentVoteComponent {
  readonly voteButton =
    'duration-base -m-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-[color,opacity,scale] enabled:hover:text-text enabled:active:scale-90 disabled:cursor-not-allowed disabled:opacity-50';

  upvotes = input.required<number>();
  downvotes = input.required<number>();
  myVote = input<CommentVoteValue | null>(null);
  disabled = input(false);
  pending = input(false);
  shake = input<CommentVoteValue | null>(null);

  readonly voteChange = output<CommentVoteValue>();

  scoreLabel = computed(() => displayScore(this.upvotes(), this.downvotes()));

  toggle(value: CommentVoteValue): void {
    if (this.disabled()) return;
    this.voteChange.emit(value);
  }
}
