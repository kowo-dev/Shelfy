import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
} from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { LayoutService } from '@app/core/services/layout/layout';
import { imageRendition } from '@shared/utils/image-rendition.util';

@Component({
  selector: 'shelfy-media-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  host: { class: 'block' },
  template: `
    <header class="media-page relative isolate pb-2">
      @if (ambientArt(); as art) {
        <div class="ambient -z-10" aria-hidden="true"><img [src]="art" alt="" /></div>
      }
      <div class="media-back"><ng-content select="[heroBack]" /></div>
      <div class="media-hero">
        @if (customArt()) {
          <div class="media-art animate-rise-in">
            <ng-content select="[headerArt]" />
          </div>
        } @else {
          <button
            type="button"
            class="media-poster animate-rise-in"
            [attr.aria-label]="'media.view_poster' | translate"
            [disabled]="!posterUrl()"
            (click)="posterOpened.emit()"
          >
            @if (posterUrl(); as poster) {
              <img [src]="poster" alt="" draggable="false" />
            }
          </button>
        }
        <div class="media-info animate-rise-in min-w-0 [animation-delay:80ms]">
          @if (editable()) {
            <textarea
              data-creation-title
              class="media-title placeholder:text-text-subtle/70 -mx-2 field-sizing-content w-[calc(100%+1rem)] max-w-[calc(22ch+1rem)] resize-none overflow-hidden rounded-xl bg-transparent px-2 py-1 transition-colors outline-none hover:bg-white/6 focus-visible:bg-white/8"
              rows="1"
              maxlength="80"
              [attr.aria-label]="titleLabel()"
              [placeholder]="titlePlaceholder()"
              [value]="title()"
              (keydown.enter)="$event.preventDefault()"
              (input)="titleChange.emit($any($event.target).value.replace(newlines, ' '))"
            ></textarea>
          } @else {
            <h1 class="media-title">{{ title() }}</h1>
          }
          @if (adult()) {
            <span
              class="bg-danger-fg/20 text-danger-fg mt-3 inline-flex h-6 items-center rounded-xs px-1.5 text-xs font-semibold"
              [title]="'media.adult_content' | translate"
              >18+</span
            >
          }
          <ng-content />
        </div>
      </div>
    </header>
  `,
})
export class MediaHeaderComponent {
  private readonly layout = inject(LayoutService);

  readonly title = input.required<string>();
  readonly posterUrl = input<string | null>(null);
  readonly backdropUrl = input<string | null>(null);
  readonly adult = input(false);
  readonly customArt = input(false);
  readonly editable = input(false);
  readonly titleLabel = input('');
  readonly titlePlaceholder = input('');

  readonly titleChange = output<string>();
  protected readonly newlines = /\r?\n/g;

  readonly posterOpened = output<void>();

  readonly ambientArt = computed(() => {
    const url = this.backdropUrl() ?? this.posterUrl();
    return url ? imageRendition(url, 'card') : null;
  });

  constructor() {
    this.layout.navOverlay.set(true);
    inject(DestroyRef).onDestroy(() => this.layout.navOverlay.set(false));
    afterRenderEffect(() => this.layout.navSolidAt.set(24));
  }
}
