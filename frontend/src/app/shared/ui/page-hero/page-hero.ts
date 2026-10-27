import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
} from '@angular/core';
import { LayoutService } from '@app/core/services/layout/layout';
import { heroSrcset, imageRendition } from '@shared/utils/image-rendition.util';

const SOLID_AFTER_PX = 24;

@Component({
  selector: 'shelfy-page-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block' },
  template: `
    <header class="relative isolate">
      <div
        class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[min(1150px,135vh)] overflow-hidden md:-top-(--nav-bar-height)"
        style="mask-image: linear-gradient(180deg, #000 35%, transparent)"
        aria-hidden="true"
      >
        @if (backdropUrl(); as image) {
          @for (url of [image]; track url) {
            <div
              class="absolute inset-0"
              animate.enter="animate-stage-in"
              animate.leave="animate-stage-out"
            >
              <img
                [src]="url"
                [attr.srcset]="srcset(url)"
                sizes="66vw"
                alt=""
                fetchpriority="high"
                class="stage-mask absolute top-0 right-0 z-1 h-[min(100%,40rem)] w-[66%] object-cover object-[70%_28%] max-md:hidden"
                [style.object-position]="backdropPosition()"
                draggable="false"
              />
              <img
                [src]="url"
                alt=""
                class="absolute -inset-[12%] size-[124%] max-w-none object-cover opacity-55 blur-[80px] saturate-[1.35]"
                draggable="false"
              />
            </div>
          }
        } @else if (tiles().length) {
          <img
            [src]="tiles()[0]"
            alt=""
            class="absolute -inset-[12%] size-[124%] max-w-none object-cover opacity-55 blur-[80px] saturate-[1.35]"
            draggable="false"
          />
        } @else {
          <div
            data-brand-wash
            class="absolute inset-0 bg-[radial-gradient(60%_55%_at_12%_0%,rgb(230_211_179/0.13),transparent_70%),radial-gradient(55%_50%_at_88%_6%,rgb(255_255_255/0.05),transparent_72%),linear-gradient(180deg,#131313_0%,transparent_70%)]"
          ></div>
        }
        <span
          class="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,transparent_0%,rgb(11_11_11/0.3)_60%,var(--color-background)_100%)]"
        ></span>
      </div>
      <div
        class="px-gutter mx-auto w-full pt-[calc(4rem+1.75rem)] md:pt-[calc(var(--nav-bar-height)+clamp(1.75rem,6vh,4.5rem))]"
      >
        <div class="flex items-end gap-4 md:gap-6">
          <ng-content select="[heroLead]" />
          <div class="min-w-0 flex-1">
            <h1
              class="font-display text-text text-[clamp(3.25rem,15vw,4.5rem)] leading-[0.86] font-extrabold tracking-[-0.06em] text-balance md:text-[clamp(4rem,8vw,8.25rem)]"
            >
              {{ title() }}
            </h1>
            <ng-content />
          </div>
        </div>
      </div>
    </header>
  `,
})
export class PageHeroComponent {
  private readonly layout = inject(LayoutService);

  readonly title = input.required<string>();
  readonly backdropUrl = input<string | null>(null);
  readonly backdropPosition = input<string | null>(null);
  readonly wall = input<string[]>([]);
  readonly tiles = computed(() => this.wall().map((url) => imageRendition(url, 'tile')));
  protected readonly srcset = heroSrcset;

  constructor() {
    this.layout.navOverlay.set(true);
    inject(DestroyRef).onDestroy(() => this.layout.navOverlay.set(false));
    this.layout.navSolidAt.set(SOLID_AFTER_PX);
  }
}
