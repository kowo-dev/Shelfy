import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink, type Params } from '@angular/router';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';

@Component({
  selector: 'shelfy-shelf-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, IconComponent],
  template: `
    <section class="v-sec" [class.v-band]="band()" [attr.aria-label]="title()">
      <div class="v-sec-h">
        <div class="min-w-0">
          <h2>{{ title() }}</h2>
          @if (subtitle(); as text) {
            <p>{{ text }}</p>
          }
        </div>
        <div class="v-tools">
          <ng-content select="[secTools]" />
          @if (moreRoute(); as route) {
            <a class="v-more" [routerLink]="route" [queryParams]="moreQuery()">
              {{ moreLabel() }}
            </a>
          }
          @if (rail() !== null && paged() && overflowing()) {
            <button
              type="button"
              class="v-pg"
              [disabled]="atStart()"
              [attr.aria-label]="'profile.rail.previous' | translate"
              (click)="page(-1)"
            >
              <shelfy-icon name="chevronLeft" size="20" />
            </button>
            <button
              type="button"
              class="v-pg"
              [disabled]="atEnd()"
              [attr.aria-label]="'profile.rail.next' | translate"
              (click)="page(1)"
            >
              <shelfy-icon name="chevronRight" size="20" />
            </button>
          }
        </div>
      </div>
      <ng-content select="[secLead]" />
      <div #scroller [class]="rail() === null ? '' : 'v-rail ' + rail()" (scroll)="measure()">
        <ng-content />
      </div>
    </section>
  `,
  host: { class: 'block' },
})
export class ShelfSectionComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly moreLabel = input<string | null>(null);
  readonly moreRoute = input<string[] | null>(null);
  readonly moreQuery = input<Params | null>(null);
  readonly band = input(false);
  readonly rail = input<string | null>('');
  readonly paged = input(true);

  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  readonly overflowing = signal(false);
  readonly atStart = signal(true);
  readonly atEnd = signal(false);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.scroller().nativeElement;
      const resize = new ResizeObserver(() => this.measure());
      const mutation = new MutationObserver(() => this.measure());
      resize.observe(el);
      mutation.observe(el, { childList: true, subtree: true });
      this.measure();
      destroyRef.onDestroy(() => {
        resize.disconnect();
        mutation.disconnect();
      });
    });
  }

  measure(): void {
    const el = this.scroller().nativeElement;
    if (this.rail() === null) return;
    this.overflowing.set(el.scrollWidth > el.clientWidth + 2);
    this.atStart.set(el.scrollLeft <= 2);
    this.atEnd.set(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }

  page(direction: 1 | -1): void {
    const el = this.scroller().nativeElement;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 20;
    el.scrollBy({ left: direction * (el.clientWidth + gap) });
  }
}
