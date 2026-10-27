import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { ButtonComponent } from '@shared/ui/button/button';
import { IconComponent } from '@shared/ui/icon/icon';
import { TranslatePipe } from '@app/shared/pipes/translate';

@Component({
  selector: 'shelfy-image-lightbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
  imports: [ButtonComponent, IconComponent, TranslatePipe],
  template: `
    <div class="fixed inset-0 z-100" role="dialog" aria-modal="true" [attr.aria-label]="imageAlt()">
      <button
        type="button"
        class="bg-overlay-scrim animate-overlay-in absolute inset-0 cursor-default backdrop-blur-sm"
        [attr.aria-label]="closeLabel() || ('dialog.close' | translate)"
        (click)="closed.emit()"
      ></button>

      <div
        class="pointer-events-none relative z-10 flex size-full items-center justify-center p-4 sm:p-8"
      >
        @if (currentImage(); as image) {
          <img
            [src]="image"
            [alt]="imageAlt()"
            class="animate-pop-in shadow-dialog max-h-full max-w-full rounded-xl object-contain"
          />
        }

        <shelfy-button
          type="button"
          variant="secondary"
          [iconOnly]="true"
          [aria-label]="closeLabel() || ('dialog.close' | translate)"
          extraClass="pointer-events-auto absolute top-3 right-3 sm:top-6 sm:right-6"
          (click)="closed.emit()"
        >
          <shelfy-icon name="close" size="md" />
        </shelfy-button>

        @if (hasMultipleImages()) {
          <shelfy-button
            type="button"
            variant="secondary"
            [iconOnly]="true"
            [aria-label]="previousLabel() || ('shared.previous_image' | translate)"
            extraClass="pointer-events-auto absolute left-3 top-1/2 -translate-y-1/2 sm:left-6"
            (click)="previous()"
          >
            <shelfy-icon name="chevronLeft" size="md" />
          </shelfy-button>
          <shelfy-button
            type="button"
            variant="secondary"
            [iconOnly]="true"
            [aria-label]="nextLabel() || ('shared.next_image' | translate)"
            extraClass="pointer-events-auto absolute right-3 top-1/2 -translate-y-1/2 sm:right-6"
            (click)="next()"
          >
            <shelfy-icon name="chevronRight" size="md" />
          </shelfy-button>
        }
      </div>
    </div>
  `,
})
export class ImageLightboxComponent {
  images = input.required<readonly string[]>();
  startIndex = input(0);
  imageAlt = input('');
  closeLabel = input('');
  previousLabel = input('');
  nextLabel = input('');
  closed = output<void>();

  readonly activeIndex = signal(0);
  readonly currentImage = computed(() => this.images()[this.activeIndex()] ?? null);
  readonly hasMultipleImages = computed(() => this.images().length > 1);

  constructor() {
    effect(() => {
      this.activeIndex.set(this.normalizeIndex(this.startIndex()));
    });
  }

  previous(): void {
    this.activeIndex.set(this.normalizeIndex(this.activeIndex() - 1));
  }

  next(): void {
    this.activeIndex.set(this.normalizeIndex(this.activeIndex() + 1));
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closed.emit();
    } else if (event.key === 'ArrowLeft' && this.hasMultipleImages()) {
      event.preventDefault();
      this.previous();
    } else if (event.key === 'ArrowRight' && this.hasMultipleImages()) {
      event.preventDefault();
      this.next();
    }
  }

  private normalizeIndex(index: number): number {
    const count = this.images().length;
    return count === 0 ? 0 : ((index % count) + count) % count;
  }
}
