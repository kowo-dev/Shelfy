import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '@shared/ui/avatar/avatar';

@Component({
  selector: 'shelfy-person-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, RouterLink, NgTemplateOutlet],
  template: `
    <div
      class="flex min-h-12 items-center gap-3 rounded-md py-1 pr-2 pl-1.5 transition-colors"
      [class]="route() || interactive() ? 'hover:bg-fill-subtle' : ''"
    >
      @if (route(); as link) {
        <a
          [routerLink]="link"
          class="flex min-w-0 flex-1 items-center gap-3 rounded-sm outline-offset-2 active:scale-[0.99]"
        >
          <ng-container [ngTemplateOutlet]="identity" />
        </a>
      } @else if (interactive()) {
        <button
          type="button"
          class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-sm text-left outline-offset-2 active:scale-[0.99]"
          (click)="activated.emit()"
        >
          <ng-container [ngTemplateOutlet]="identity" />
        </button>
      } @else {
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <ng-container [ngTemplateOutlet]="identity" />
        </div>
      }
      <div class="flex shrink-0 items-center gap-2">
        <ng-content select="[personRowActions]" />
      </div>
    </div>

    <ng-template #identity>
      <shelfy-avatar [displayName]="displayName()" [avatarUrl]="avatarUrl()" size="40" />
      <span class="flex min-w-0 flex-col">
        <span class="text-text truncate text-base leading-tight font-semibold">{{
          displayName()
        }}</span>
        @if (subline(); as text) {
          <span class="text-text-subtle truncate text-sm leading-tight">{{ text }}</span>
        }
      </span>
    </ng-template>
  `,
  host: { class: 'block min-w-0' },
})
export class PersonRowComponent {
  displayName = input.required<string>();
  avatarUrl = input<string | null>(null);
  subline = input<string | null>(null);
  route = input<string | readonly unknown[] | null>(null);
  interactive = input(false);
  activated = output<void>();
}
