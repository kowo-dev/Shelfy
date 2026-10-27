import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon';

@Component({
  selector: 'shelfy-import-card-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { class: 'bg-surface rounded-card block overflow-hidden' },
  template: `
    <div class="relative flex aspect-16/7 gap-0.5 overflow-hidden">
      @for (cover of covers(); track $index) {
        <img
          [src]="cover"
          alt=""
          loading="lazy"
          draggable="false"
          class="h-full min-w-0 flex-1 object-cover"
        />
      } @empty {
        <span class="bg-profile-fallback flex-1"></span>
      }
      <span
        class="from-surface absolute inset-0 bg-linear-to-t to-transparent to-60%"
        aria-hidden="true"
      ></span>
    </div>
    <div class="relative -mt-9 flex flex-wrap items-end gap-x-4 gap-y-4 px-5 pb-5">
      <span
        class="bg-surface-raised text-text ring-surface grid size-18 shrink-0 place-items-center rounded-full ring-4"
      >
        <shelfy-icon [name]="icon()" size="32" />
      </span>
      <div class="min-w-0 flex-1 basis-40 pb-1">
        <p class="font-display text-text text-lg font-bold">{{ title() }}</p>
        <ng-content select="[status]" />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <ng-content select="[actions]" />
      </div>
    </div>
    <div class="flex flex-col gap-4 px-5 pb-5 empty:hidden">
      <ng-content />
    </div>
  `,
})
export class ImportCardShellComponent {
  readonly icon = input.required<string>();
  readonly title = input.required<string>();
  readonly covers = input<string[]>([]);
}
