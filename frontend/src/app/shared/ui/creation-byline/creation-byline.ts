import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { AvatarComponent } from '@shared/ui/avatar/avatar';
import { IconComponent } from '@shared/ui/icon/icon';

@Component({
  selector: 'shelfy-creation-byline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, AvatarComponent, IconComponent],
  host: { class: 'flex items-center gap-x-3 text-base' },
  template: `
    <a
      [routerLink]="['/profile', owner()]"
      class="text-text flex items-center gap-2 font-semibold hover:underline"
    >
      <shelfy-avatar size="32" [displayName]="owner()" [avatarUrl]="avatarUrl()" />
      {{ owner() }}
    </a>
    <span class="text-text-subtle" aria-hidden="true">·</span>
    <span class="inline-flex items-center gap-1.5 tabular-nums">
      <shelfy-icon name="like" size="22" [active]="true" />{{ likes() }}
    </span>
    <span class="text-text-subtle" aria-hidden="true">·</span>
    <button
      type="button"
      class="hover:text-text inline-flex cursor-pointer items-center gap-1.5 tabular-nums transition-colors"
      [attr.aria-label]="'comments.title' | translate"
      (click)="commentsClick.emit()"
    >
      <shelfy-icon name="comment" size="22" />{{ comments() }}
    </button>
  `,
})
export class CreationBylineComponent {
  readonly owner = input.required<string>();
  readonly avatarUrl = input<string | null>(null);
  readonly likes = input.required<number>();
  readonly comments = input.required<number>();
  readonly commentsClick = output<void>();
}
