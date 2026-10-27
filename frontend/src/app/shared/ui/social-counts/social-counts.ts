import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import { LikeButtonComponent } from '@shared/ui/like-button/like-button';

@Component({
  selector: 'shelfy-social-counts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, LikeButtonComponent, TranslatePipe],
  template: `
    @if (likeCount() !== null) {
      <shelfy-like-button [readonly]="true" [liked]="liked()" [count]="likeCount()!" />
    }
    @if (commentCount() !== null) {
      <span
        class="text-text-muted inline-flex items-center gap-1.5 text-base font-semibold tabular-nums"
        role="img"
        [attr.aria-label]="'social.comments' | translate: { count: commentCount() ?? 0 }"
      >
        <shelfy-icon name="comment" size="20" />
        {{ commentCount() }}
      </span>
    }
  `,
  host: { class: 'flex items-center gap-4' },
})
export class SocialCountsComponent {
  likeCount = input<number | null>(0);
  commentCount = input<number | null>(null);
  liked = input(false);
}
