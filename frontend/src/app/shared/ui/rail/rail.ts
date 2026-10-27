import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink, type Params } from '@angular/router';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';

@Component({
  selector: 'shelfy-rail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, TranslatePipe, IconComponent],
  template: `
    <section class="group/rail md:px-gutter" [attr.aria-label]="title()">
      <div class="max-md:px-gutter flex items-center justify-between gap-3">
        <h2
          class="font-display text-text text-[1.75rem] leading-none font-extrabold tracking-[-0.045em] text-balance md:text-[2.25rem]"
        >
          {{ title() }}
          @if (count() !== null) {
            <span class="text-text-subtle ml-2 font-sans text-base font-medium tabular-nums">{{
              count()
            }}</span>
          }
        </h2>
        <div class="flex shrink-0 items-center gap-2">
          @if (viewAllRoute(); as route) {
            <a
              [routerLink]="route"
              [queryParams]="viewAllQuery()"
              class="text-text-muted hover:text-text touch:opacity-100 -my-2.5 -mr-1 inline-flex h-11 shrink-0 items-center px-2 text-base font-medium whitespace-nowrap opacity-0 transition-[color,background-color,opacity] group-focus-within/rail:opacity-100 group-hover/rail:opacity-100 focus-visible:opacity-100 active:opacity-70"
            >
              {{ 'profile.rail.view_all' | translate }}
            </a>
          }
          @if (arrows() && !cards() && overflowing()) {
            <button
              type="button"
              class="bg-fill text-text hover:bg-fill-strong hidden size-9 cursor-pointer items-center justify-center rounded-full transition-[background-color,opacity] active:opacity-70 md:flex"
              [attr.aria-label]="'profile.rail.previous' | translate"
              (click)="scroll(-1)"
            >
              <shelfy-icon name="chevronLeft" size="sm" />
            </button>
            <button
              type="button"
              class="bg-fill text-text hover:bg-fill-strong hidden size-9 cursor-pointer items-center justify-center rounded-full transition-[background-color,opacity] active:opacity-70 md:flex"
              [attr.aria-label]="'profile.rail.next' | translate"
              (click)="scroll(1)"
            >
              <shelfy-icon name="chevronRight" size="sm" />
            </button>
          }
        </div>
      </div>
      <ng-content select="[railTabs]" />
      @if (cards()) {
        <div
          class="max-md:px-gutter mt-4 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-3 overflow-x-auto max-md:*:w-[84%] max-md:*:shrink-0 max-md:*:snap-start md:mt-5 md:grid md:[grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr))] md:overflow-visible [&::-webkit-scrollbar]:hidden"
        >
          <ng-container [ngTemplateOutlet]="body" />
        </div>
      } @else {
        <div
          #scroller
          class="max-md:px-gutter touch:overflow-x-auto -mb-2.5 flex snap-x snap-mandatory scroll-px-(--frame-x) [scrollbar-width:none] gap-(--rail-gap) overflow-x-auto py-4 md:scroll-px-0 md:overflow-x-hidden md:py-5 [&::-webkit-scrollbar]:hidden"
        >
          <ng-container [ngTemplateOutlet]="body" />
        </div>
      }
    </section>
    <ng-template #body><ng-content /></ng-template>
  `,
})
export class RailComponent {
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  title = input.required<string>();
  count = input<number | null>(null);
  viewAllRoute = input<string[] | null>(null);
  viewAllQuery = input<Params | null>(null);
  arrows = input(true);
  cards = input(false);

  protected readonly overflowing = signal(false);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.scroller()?.nativeElement;
      if (!el) return;
      const measure = () => this.overflowing.set(el.scrollWidth > el.clientWidth + 1);
      const resize = new ResizeObserver(measure);
      const mutation = new MutationObserver(measure);
      resize.observe(el);
      mutation.observe(el, { childList: true });
      measure();
      destroyRef.onDestroy(() => {
        resize.disconnect();
        mutation.disconnect();
      });
    });
  }

  protected scroll(direction: 1 | -1): void {
    const el = this.scroller()?.nativeElement;
    if (!el) return;
    const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    el.scrollBy({ left: direction * el.clientWidth, behavior: reduced ? 'auto' : 'smooth' });
  }
}
