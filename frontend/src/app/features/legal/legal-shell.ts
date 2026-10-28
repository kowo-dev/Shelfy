import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  type ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { LayoutService } from '@app/core/services/layout/layout';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { PageFooterComponent } from '@shared/ui/page-footer/page-footer';
import { PageHeroComponent } from '@shared/ui/page-hero/page-hero';
import { TabsComponent, type TabItem } from '@shared/ui/tabs/tabs';
import { createPosterWall } from '@shared/utils/poster-wall.util';

export type LegalDocument = 'privacy' | 'terms' | 'notice';

const DOCUMENTS: readonly { id: LegalDocument; path: string; label: string }[] = [
  { id: 'privacy', path: '/legal/privacy-policy', label: 'auth.terms_privacy_policy' },
  { id: 'terms', path: '/legal/terms', label: 'auth.terms_of_service' },
  { id: 'notice', path: '/legal/notice', label: 'legal.notice.title' },
];

@Component({
  selector: 'shelfy-legal-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, PageHeroComponent, PageFooterComponent, TabsComponent],
  host: { class: 'block h-full min-h-0' },
  template: `
    <div
      #scrollContainer
      class="page-scroll h-full min-h-0 [scrollbar-gutter:stable] overflow-x-clip overflow-y-auto [overflow-anchor:none] max-md:pb-(--bottom-nav-clearance)"
      (scroll)="onScroll()"
    >
      <shelfy-page-hero [title]="title()" [wall]="wall.posters()" />

      <div #barSentinel aria-hidden="true"></div>
      <div class="page-bar" [class.is-stuck]="stuck()">
        <shelfy-tabs
          class="min-w-0"
          [navigation]="true"
          [tabs]="tabs()"
          [activeId]="active()"
          [label]="'legal.title' | translate"
          (tabSelected)="open($event)"
        />
      </div>

      <div class="px-gutter mx-auto w-full pt-4.5">
        <article
          class="animate-rise-in flex min-w-0 flex-col gap-10 pt-3 pb-35 motion-reduce:animate-none md:max-w-[72ch]"
        >
          <ng-content />
        </article>
      </div>
      <shelfy-page-footer />
    </div>
  `,
})
export class LegalShellComponent {
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly layout = inject(LayoutService);
  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');
  private readonly barSentinel = viewChild<ElementRef<HTMLElement>>('barSentinel');

  readonly title = input.required<string>();
  readonly active = input.required<LegalDocument>();

  protected readonly wall = createPosterWall();
  readonly stuck = signal(false);

  readonly tabs = computed<TabItem[]>(() => {
    this.translate.lang();
    return DOCUMENTS.map((document) => ({
      id: document.id,
      label: this.translate.get(document.label),
    }));
  });

  constructor() {
    this.wall.load();
    this.layout.scrollTop.set(0);
    inject(DestroyRef).onDestroy(() => this.layout.scrollTop.set(0));
  }

  open(id: string): void {
    const document = DOCUMENTS.find((item) => item.id === id);
    if (document) void this.router.navigateByUrl(document.path);
  }

  onScroll(): void {
    const el = this.scrollContainer()?.nativeElement;
    this.layout.scrollTop.set(el?.scrollTop ?? 0);
    const sentinel = this.barSentinel()?.nativeElement;
    if (!el || !sentinel) return;
    const top = sentinel.getBoundingClientRect().top - el.getBoundingClientRect().top;
    const nav =
      window.innerWidth >= 768
        ? parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--nav-bar-height'),
          ) || 76
        : 0;
    this.stuck.set(top < nav - 0.5);
  }
}
