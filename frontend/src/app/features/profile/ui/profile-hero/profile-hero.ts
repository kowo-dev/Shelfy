import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { AmbientService } from '@app/core/services/ambient/ambient';
import { LayoutService } from '@app/core/services/layout/layout';
import { TranslatePipe } from '@app/shared/pipes/translate';
import type { Crumb } from '@shared/ui/breadcrumb/breadcrumb';
import { heroSrcset } from '@shared/utils/image-rendition.util';

@Component({
  selector: 'shelfy-profile-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './profile-hero.html',
  host: { class: 'block' },
})
export class ProfileHeroComponent {
  private readonly ambient = inject(AmbientService);
  private readonly layout = inject(LayoutService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly name = input.required<string>();
  readonly crumbs = input<Crumb[]>([]);
  readonly meta = input<string[]>([]);
  readonly bio = input<string | null>(null);
  readonly bannerUrl = input<string | null>(null);
  readonly bannerPosition = input(50);
  protected readonly srcset = heroSrcset;

  protected readonly expanded = signal(false);
  protected readonly clamped = signal(false);
  private readonly bioText = viewChild<ElementRef<HTMLElement>>('bioText');

  constructor() {
    this.layout.navOverlay.set(true);
    inject(DestroyRef).onDestroy(() => {
      this.layout.navOverlay.set(false);
      void this.ambient.follow(null);
    });
    afterRenderEffect(() =>
      this.layout.navSolidAt.set(
        Math.max(0, (this.host.nativeElement.querySelector('header')?.offsetHeight ?? 0) - 80),
      ),
    );
    effect(() => void this.ambient.follow(this.bannerUrl()));
    effect(() => {
      this.bio();
      untracked(() => this.expanded.set(false));
    });
    afterRenderEffect(() => {
      const el = this.bioText()?.nativeElement;
      this.bio();
      if (el && !this.expanded()) this.clamped.set(el.scrollHeight > el.clientHeight + 1);
    });
  }
}
