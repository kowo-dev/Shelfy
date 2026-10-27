import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { environment } from '@env';

@Component({
  selector: 'shelfy-page-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  template: `
    <footer
      class="text-text-subtle flex flex-wrap items-baseline gap-x-7 gap-y-2 px-(--frame-x) pt-24 pb-12 text-[0.8125rem]"
    >
      <b class="font-display text-text tracking-[-0.03em]">Shelfy</b>
      <span>
        Made by
        <a routerLink="/profile/kowo" class="text-text-muted hover:text-text font-semibold"
          >&#64;kowo</a
        >
        ·
        <a
          href="https://github.com/kowo-dev/Shelfy"
          target="_blank"
          rel="noopener noreferrer"
          class="text-text-muted hover:text-text font-semibold"
          >GitHub</a
        >
        · {{ version }}
      </span>
      <a routerLink="/legal/privacy-policy" class="hover:text-text transition-colors">{{
        'auth.terms_privacy_policy' | translate
      }}</a>
      <a routerLink="/legal/terms" class="hover:text-text transition-colors">{{
        'auth.terms_of_service' | translate
      }}</a>
      <a routerLink="/legal/notice" class="hover:text-text transition-colors">{{
        'legal.notice.title' | translate
      }}</a>
    </footer>
  `,
  host: { class: 'block' },
})
export class PageFooterComponent {
  readonly version = environment.version;
}
