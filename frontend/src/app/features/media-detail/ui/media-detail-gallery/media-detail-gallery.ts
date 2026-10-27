import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { ShelfSectionComponent } from '@shared/ui/shelf-section/shelf-section';
import { CARD_LIFT } from '@shared/ui/ui-recipes';

@Component({
  selector: 'shelfy-media-detail-gallery',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, TranslatePipe, ShelfSectionComponent],
  templateUrl: './media-detail-gallery.html',
  host: { class: 'block min-w-0' },
})
export class MediaDetailGalleryComponent {
  readonly cardSurface = CARD_LIFT;

  readonly images = input.required<string[]>();
  readonly imageSelected = output<string>();
}
