import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@app/shared/pipes/translate';

export interface Crumb {
  label: string;
  link?: string | readonly unknown[];
  query?: Record<string, string>;
}

@Component({
  selector: 'shelfy-breadcrumb',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  host: { class: 'block min-w-0' },
  template: `
    <nav
      [attr.aria-label]="'nav.breadcrumb' | translate"
      class="text-text-muted duration-base text-sm font-medium opacity-55 transition-opacity focus-within:opacity-100 hover:opacity-100"
    >
      <ol class="flex min-w-0 items-center gap-1.5">
        @for (crumb of items(); track $index) {
          <li class="flex min-w-0 items-center gap-1.5">
            @if (!$first) {
              <span class="text-text-subtle shrink-0" aria-hidden="true">›</span>
            }
            @if (crumb.link && !$last) {
              <a [routerLink]="crumb.link" [queryParams]="crumb.query" [class]="linkClass">{{
                crumb.label
              }}</a>
            } @else {
              <span class="truncate" [attr.aria-current]="$last ? 'page' : null">{{
                crumb.label
              }}</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
})
export class BreadcrumbComponent {
  readonly trail = input<Crumb[]>([]);
  readonly current = input('');

  protected readonly items = computed(() => {
    const trail = this.trail();
    const last = trail.at(-1);
    return last && !last.link ? trail : [...trail, { label: this.current() }];
  });

  protected readonly linkClass =
    'hover:text-text duration-fast block truncate rounded-xs transition-colors underline-offset-3 hover:underline';
}
