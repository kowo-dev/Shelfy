import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';

export interface TabItem {
  id: string;
  label: string;
  count?: number | string | null;
  separated?: boolean;
  dot?: string | null;
  dotLabel?: string;
}

@Component({
  selector: 'shelfy-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tabs.html',
  host: { class: 'block min-w-0 max-w-full' },
})
export class TabsComponent {
  tabs = input.required<TabItem[]>();
  activeId = input.required<string>();

  tabSelected = output<string>();
  panelId = input<string | null>(null);
  label = input<string | null>(null);
  navigation = input(false);

  private readonly tabButtons = viewChildren<ElementRef<HTMLElement>>('tabButton');
  private readonly scrollContainer = viewChild.required<ElementRef<HTMLElement>>('scrollContainer');

  readonly canScrollStart = signal(false);
  readonly canScrollEnd = signal(false);
  readonly fade = computed(() => {
    const start = this.canScrollStart();
    const end = this.canScrollEnd();
    if (!start && !end) return null;
    return `linear-gradient(90deg, ${start ? 'transparent' : '#000'}, #000 2rem, #000 calc(100% - 2rem), ${end ? 'transparent' : '#000'})`;
  });

  private readonly destroyRef = inject(DestroyRef);

  onKeydown(event: KeyboardEvent, index: number): void {
    if (this.navigation()) return;
    const last = this.tabs().length - 1;
    const targets: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    this.tabSelected.emit(this.tabs()[target].id);
    (event.currentTarget as HTMLElement).parentElement
      ?.querySelectorAll<HTMLElement>('[role="tab"]')
      [target]?.focus();
  }

  private revealTab(tab: HTMLElement): void {
    const strip = this.scrollContainer().nativeElement;
    const inset = 32;
    const start = tab.offsetLeft - inset;
    const end = tab.offsetLeft + tab.offsetWidth + inset - strip.clientWidth;
    if (strip.scrollLeft > start) strip.scrollTo?.({ left: start, behavior: 'smooth' });
    else if (strip.scrollLeft < end) strip.scrollTo?.({ left: end, behavior: 'smooth' });
  }

  constructor() {
    effect(() => {
      const index = this.tabs().findIndex((tab) => tab.id === this.activeId());
      const el = this.tabButtons()[index]?.nativeElement;
      if (el) this.revealTab(el);
    });
    afterNextRender(() => {
      const el = this.scrollContainer().nativeElement;
      const update = (): void => {
        this.canScrollStart.set(el.scrollLeft > 4);
        this.canScrollEnd.set(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
      };
      update();
      el.addEventListener('scroll', update, { passive: true });
      this.destroyRef.onDestroy(() => el.removeEventListener('scroll', update));
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(update);
      observer.observe(el);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
