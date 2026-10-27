import { ChangeDetectionStrategy, Component, effect, input, signal } from '@angular/core';
import { TranslatePipe } from '@shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';

@Component({
  selector: 'shelfy-scroll-top',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TranslatePipe],
  host: { class: 'pointer-events-none absolute right-4 bottom-4 z-20' },
  template: `
    <button
      type="button"
      class="bg-text text-background shadow-raise duration-base grid size-11 cursor-pointer place-items-center rounded-full transition-[opacity,translate,scale] active:scale-[0.94]"
      [class]="
        visible() ? 'pointer-events-auto translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      "
      [attr.tabindex]="visible() ? 0 : -1"
      [attr.aria-hidden]="visible() ? null : true"
      [attr.aria-label]="'shared.scroll_top' | translate"
      (click)="scrollToTop()"
    >
      <shelfy-icon name="arrowUp" size="sm" />
    </button>
  `,
})
export class ScrollTopComponent {
  target = input<HTMLElement | null>(null);
  threshold = input(240);

  protected readonly visible = signal(false);

  constructor() {
    effect((onCleanup) => {
      const el = this.target();
      if (!el) return;
      const update = (): void => this.visible.set(el.scrollTop > this.threshold());
      el.addEventListener('scroll', update, { passive: true });
      update();
      onCleanup(() => el.removeEventListener('scroll', update));
    });
  }

  protected scrollToTop(): void {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.target()?.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }
}
