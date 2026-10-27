import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { VersusEntry } from '@app/core/services/versus/versus.model';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { AdultBadgeComponent } from '@shared/ui/adult-badge/adult-badge';
import { IconComponent } from '@shared/ui/icon/icon';
import { ClipPlayerComponent } from '../clip-player/clip-player';
import { clipSourceUrl } from '../clip-player/clip-embed.util';

@Component({
  selector: 'shelfy-versus-entry-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, AdultBadgeComponent, IconComponent, ClipPlayerComponent],
  template: `
    <div
      class="v-poster group/card"
      [class.v-tile]="!!entry().clip"
      [class.v-dim]="selectionMode() && !selected()"
    >
      <span
        class="v-art outline-3 outline-offset-3 transition-[outline-color]"
        [class]="selectionMode() && selected() ? 'outline-accent' : 'outline-transparent'"
      >
        <button
          type="button"
          class="block size-full cursor-pointer outline-none"
          [attr.role]="selectionMode() ? 'checkbox' : null"
          [attr.aria-checked]="selectionMode() ? selected() : null"
          [attr.aria-label]="coverLabel()"
          [title]="entry().clip && !selectionMode() ? coverLabel() : null"
          (click)="onCover()"
        >
          @if (masked()) {
            <span
              class="text-text-subtle flex size-full flex-col items-center justify-center gap-2 p-4 text-center"
            >
              <shelfy-adult-badge size="4rem" />
              <span class="text-sm font-medium">{{ 'adult.hidden' | translate }}</span>
            </span>
          } @else if (entry().coverUrl; as cover) {
            <img [src]="cover" alt="" class="size-full object-cover" loading="lazy" />
          } @else {
            <span
              class="text-text-subtle flex size-full flex-col items-center justify-center gap-2 p-4 text-center"
            >
              <shelfy-icon [name]="kindIcon()" size="lg" />
              <span class="text-sm font-medium">{{ label() }}</span>
            </span>
          }
        </button>
        @if (entry().clip; as clip) {
          @if (!selectionMode()) {
            <shelfy-clip-player [key]="playerKey()" [clip]="clip" />
          }
        }
        @if (selectionMode()) {
          <span class="v-check" [class.on]="selected()" aria-hidden="true">
            <shelfy-icon name="check" size="16" />
          </span>
        }
        <ng-content select="[cardOverlay]" />
      </span>
      <span class="v-cap">
        @if (entry().clip && entry().media) {
          <button
            type="button"
            class="min-w-0 cursor-pointer truncate text-left hover:underline"
            [title]="label()"
            (click)="opened.emit(entry())"
          >
            <b>{{ label() }}</b>
          </button>
        } @else {
          <b [title]="label()">{{ label() }}</b>
        }
      </span>
      <span class="v-sub">
        <span class="flex min-w-0 items-center gap-1.5">
          @if (entry().clip) {
            <shelfy-icon [name]="kindIcon()" size="14" class="shrink-0" />
          }
          <span class="truncate">{{ meta() | translate }}{{ author() }}</span>
        </span>
      </span>
    </div>
  `,
})
export class VersusEntryCardComponent {
  private readonly translate = inject(TranslateService);

  entry = input.required<VersusEntry>();
  key = input<string | null>(null);

  selectionMode = input(false);
  selected = input(false);

  opened = output<VersusEntry>();
  selectionToggle = output<void>();

  protected readonly masked = computed(() => !!this.entry().media?.isAdult && !this.entry().title);
  protected readonly label = computed(() =>
    this.masked() ? this.translate.get('adult.hidden') : this.entry().title,
  );

  protected readonly playerKey = computed(() => this.key() ?? this.entry().id);

  protected onCover(): void {
    if (this.selectionMode()) {
      this.selectionToggle.emit();
      return;
    }
    const clip = this.entry().clip;
    if (clip) {
      window.open(clipSourceUrl(clip), '_blank', 'noopener,noreferrer');
      return;
    }
    this.opened.emit(this.entry());
  }

  protected readonly coverLabel = computed(() => {
    this.translate.lang();
    return this.entry().clip
      ? this.translate.get('versus.clip.open_source', { title: this.label() })
      : this.label();
  });
  protected readonly kindIcon = computed(() => {
    const clip = this.entry().clip;
    if (!clip) return 'grid' as const;
    return 'video' as const;
  });
  protected readonly meta = computed(() => {
    const { clip, media } = this.entry();
    if (clip) return 'versus.clip.video';
    return media ? `collection.media_type_one.${media.mediaType}` : '';
  });
  protected readonly author = computed(() => {
    const author = this.entry().clip?.author;
    return author ? ` · ${author}` : '';
  });
}
