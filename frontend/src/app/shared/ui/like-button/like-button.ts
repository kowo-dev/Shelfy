import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import { HIT_AREA_40 } from '@shared/ui/ui-recipes';
import { buttonClasses } from '@shared/ui/button/button';

@Component({
  selector: 'shelfy-like-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TranslatePipe, NgTemplateOutlet],
  template: `
    <ng-template #content>
      <span
        class="inline-flex motion-reduce:animate-none"
        [class.animate-pop-in]="popping()"
        (animationend)="popping.set(false)"
      >
        <shelfy-icon name="like" [size]="size() === 'md' ? '20' : '18'" [active]="liked()" />
      </span>
      <span class="inline-grid overflow-hidden tabular-nums" aria-live="polite">
        @for (n of [count()]; track n) {
          <span
            class="col-start-1 row-start-1"
            [animate.enter]="touched() ? 'animate-count-in' : ''"
            [animate.leave]="touched() ? 'animate-count-out' : ''"
            >{{ n }}</span
          >
        }
      </span>
    </ng-template>

    @if (readonly()) {
      <span
        class="text-text-muted inline-flex items-center gap-1.5 text-base font-semibold"
        [attr.aria-label]="'social.likes' | translate: { count: count() }"
        role="img"
      >
        <ng-container [ngTemplateOutlet]="content" />
      </span>
    } @else {
      <button
        type="button"
        [class]="buttonClass()"
        [attr.aria-pressed]="liked()"
        [attr.aria-busy]="pending() ? true : null"
        [attr.aria-label]="(liked() ? 'social.unlike' : 'social.like') | translate"
        (click)="onClick()"
      >
        <ng-container [ngTemplateOutlet]="content" />
      </button>
    }
  `,
  host: { class: 'inline-flex' },
})
export class LikeButtonComponent {
  liked = input(false);
  count = input(0);
  readonly = input(false);
  pending = input(false);
  size = input<'md' | 'sm'>('md');
  toggled = output<void>();

  protected readonly popping = signal(false);
  protected readonly touched = signal(false);

  protected readonly buttonClass = computed(() =>
    this.size() === 'md'
      ? buttonClasses({
          variant: 'secondary',
          extraClass:
            'gap-2 active:scale-[0.97] aria-pressed:bg-fill-strong aria-pressed:text-text',
        })
      : `${HIT_AREA_40} inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-2 text-sm text-text-subtle transition-colors hover:text-text active:scale-[0.97] aria-pressed:text-text`,
  );

  protected onClick(): void {
    if (this.pending()) return;
    this.touched.set(true);
    this.popping.set(!this.liked());
    this.toggled.emit();
  }
}
