import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { AddSheetService } from '@app/core/services/add-sheet/add-sheet';
import { ItemSheetService } from '@app/core/services/item-sheet/item-sheet';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { ShelfLookupService } from '@app/core/services/shelf-lookup/shelf-lookup';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import { buildAddTarget } from '@shared/utils/add-target.util';
import { imageRendition } from '@shared/utils/image-rendition.util';
import type { HomeArtResolver } from '../../data-access/home-art';

@Component({
  selector: 'shelfy-home-tile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IconComponent],
  template: `
    <article
      class="v-tile"
      tabindex="0"
      [attr.aria-label]="item().media.title"
      (click)="open()"
      (keydown.enter)="open()"
    >
      <span class="v-art">
        @if (backdrop(); as url) {
          <img [src]="url" alt="" loading="lazy" draggable="false" />
        } @else if (cover(); as url) {
          <img class="v-blur" [src]="url" alt="" aria-hidden="true" loading="lazy" />
          <img class="v-fit" [src]="url" alt="" loading="lazy" draggable="false" />
        } @else {
          <span class="v-noimg" aria-hidden="true"><shelfy-icon name="noImage" size="32" /></span>
        }
        <ng-content select="[tileArt]" />
        @if (addable()) {
          @if (owned(); as mine) {
            <button
              type="button"
              class="v-add done"
              [attr.aria-label]="('collection.edit' | translate) + ' · ' + mine.media.title"
              (click)="$event.stopPropagation(); itemSheet.open(mine)"
            >
              <shelfy-icon name="check" size="20" />
            </button>
          } @else {
            <button
              type="button"
              class="v-add"
              [attr.aria-label]="
                ('collection.backlog.add' | translate) + ' · ' + item().media.title
              "
              (click)="$event.stopPropagation(); shelve()"
            >
              <shelfy-icon name="plus" size="20" />
            </button>
          }
        }
      </span>
      <ng-content />
    </article>
  `,
  host: { class: 'block min-w-0' },
})
export class HomeTileComponent {
  private readonly lookup = inject(ShelfLookupService);
  private readonly addSheet = inject(AddSheetService);
  protected readonly itemSheet = inject(ItemSheetService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly item = input.required<CollectionItemResponse>();
  readonly art = input<HomeArtResolver | null>(null);
  readonly wide = input<string | null>(null);
  readonly addable = input(true);

  private readonly resolved = signal<string | null>(null);
  readonly backdrop = computed(() => this.wide() ?? this.resolved());
  readonly cover = computed(() => {
    const url = this.item().media.coverUrl;
    return url ? imageRendition(url, 'card') : null;
  });
  readonly owned = computed(() => this.lookup.find(this.item().media));

  constructor() {
    effect(() => this.lookup.request(this.item().media));
    effect((onCleanup) => {
      const resolve = this.art();
      const item = this.item();
      this.resolved.set(null);
      if (!resolve || this.wide()) return;
      const subscription = resolve(item).subscribe((art) => this.resolved.set(art?.card ?? null));
      onCleanup(() => subscription.unsubscribe());
    });
  }

  open(): void {
    const { media } = this.item();
    void this.router.navigate(['/media', media.mediaType, media.externalId]);
  }

  shelve(): void {
    const item = this.item();
    this.addSheet.open(
      buildAddTarget(item, this.translate.get('collection.media_type_one.' + item.media.mediaType)),
    );
  }
}
