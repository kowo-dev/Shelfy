import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { SearchFocusService } from '@app/core/services/search-focus/search-focus';
import { IconComponent } from '@shared/ui/icon/icon';

const GHOST =
  'text-text hover:bg-surface-2 inline-flex h-12 items-center gap-2.25 rounded-full pr-5 pl-4 text-base font-semibold shadow-[inset_0_0_0_1px_var(--color-border-strong)] transition-colors';

@Component({
  selector: 'shelfy-start-shelf',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, IconComponent],
  template: `
    <section aria-labelledby="home-start-title">
      <h2
        id="home-start-title"
        class="font-display text-text text-[1.375rem] leading-[1.1] font-bold tracking-[-0.03em] md:text-[1.875rem]"
      >
        {{ 'home.start.title' | translate }}
      </h2>
      <p class="text-text-muted mt-2 max-w-[60ch] text-base md:text-[1.0625rem]">
        {{ 'home.start.body' | translate }}
      </p>
      <button
        type="button"
        class="bg-surface-2 text-text-subtle hover:bg-surface-3 mt-6 flex h-16 w-full max-w-160 cursor-pointer items-center gap-3.5 rounded-full pr-3 pl-5.5 text-left text-[1.0625rem] shadow-[inset_0_0_0_1px_var(--color-border-strong)] transition-colors"
        (click)="search.open()"
      >
        <shelfy-icon name="search" size="24" class="text-text-muted" />
        <span class="min-w-0 flex-1 truncate">{{ 'home.start.search' | translate }}</span>
        <kbd
          class="bg-surface-4 text-text-muted rounded-full px-2.75 py-1.5 font-sans text-xs max-md:hidden"
          >⌘K</kbd
        >
      </button>
      <div class="mt-4 flex flex-wrap items-center gap-2.5">
        <span class="text-text-subtle mr-1 text-sm max-md:w-full">{{
          'home.start.imports' | translate
        }}</span>
        <a routerLink="/settings" [queryParams]="{ section: 'connections' }" [class]="ghost">
          <shelfy-icon name="download" size="20" class="text-text-muted" />
          {{ 'home.start.letterboxd' | translate }}
        </a>
        <a routerLink="/settings" [queryParams]="{ section: 'connections' }" [class]="ghost">
          <shelfy-icon name="game" size="20" class="text-text-muted" />
          {{ 'home.start.steam' | translate }}
        </a>
      </div>
    </section>
  `,
  host: { class: 'block' },
})
export class StartShelfComponent {
  protected readonly search = inject(SearchFocusService);
  protected readonly ghost = GHOST;
}
