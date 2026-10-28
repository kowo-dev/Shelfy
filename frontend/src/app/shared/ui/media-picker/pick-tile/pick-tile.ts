import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';

@Component({
  selector: 'shelfy-pick-tile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TranslatePipe],
  host: { class: 'block min-w-0' },
  template: `
    <button
      type="button"
      class="poster w-full touch-manipulation text-left outline-none"
      [attr.aria-pressed]="selected()"
      [attr.aria-label]="title()"
      (click)="toggled.emit()"
    >
      <span
        class="cover outline-3 outline-offset-3 transition-[outline-color]"
        [class]="selected() ? 'outline-accent' : 'outline-transparent'"
      >
        @if (poster(); as src) {
          <img
            [src]="src"
            alt=""
            loading="lazy"
            decoding="async"
            draggable="false"
            class="duration-base transition-opacity motion-reduce:transition-none"
            [class.opacity-0]="!loaded()"
            (load)="loaded.set(true)"
          />
        } @else {
          <span class="text-text-subtle grid size-full place-items-center p-3 text-center text-sm">
            {{ title() }}
          </span>
        }
        <span class="cover-check" [class.is-on]="selected()" aria-hidden="true">
          <shelfy-icon name="check" size="16" />
        </span>
      </span>
      <span class="caption">
        <b [title]="title()">{{ title() }}</b>
      </span>
      <span class="caption-sub">
        <span class="flex min-w-0 items-center gap-1 tabular-nums">
          @if (owned()) {
            <shelfy-icon
              name="check"
              size="14"
              class="text-text-muted shrink-0"
              [attr.title]="'collection.in_shelf' | translate"
            />
            <span class="sr-only">{{ 'collection.in_shelf' | translate }} ·</span>
          }
          <span class="truncate">{{ meta() }}</span>
        </span>
      </span>
    </button>
  `,
})
export class PickTileComponent {
  readonly title = input.required<string>();
  readonly poster = input<string | null>(null);
  readonly meta = input('');
  readonly selected = input(false);
  readonly owned = input(false);
  readonly toggled = output<void>();

  readonly loaded = signal(false);
}
