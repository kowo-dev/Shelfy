import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import type { CollectionVisibility } from '@app/core/services/auth/auth.model';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { buttonClasses } from '@shared/ui/button/button';
import { DialogComponent } from '@shared/ui/dialog/dialog';
import { IconComponent } from '@shared/ui/icon/icon';

const VISIBILITIES: readonly { value: CollectionVisibility; icon: string; key: string }[] = [
  { value: 'public', icon: 'eye', key: 'public' },
  { value: 'link', icon: 'link', key: 'link' },
  { value: 'private', icon: 'lock', key: 'private' },
];

@Component({
  selector: 'shelfy-publish-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, DialogComponent, IconComponent],
  template: `
    <shelfy-dialog
      [open]="open()"
      [title]="'studio.publish_title' | translate"
      size="sm"
      (closed)="closed.emit()"
    >
      <div
        class="flex flex-col gap-2"
        role="radiogroup"
        [attr.aria-label]="'studio.publish_title' | translate"
      >
        @for (option of visibilities; track option.value) {
          @let active = choice() === option.value;
          <button
            type="button"
            role="radio"
            class="text-text duration-slow flex w-full cursor-pointer items-start gap-3.5 rounded-[1.25rem] p-4.5 text-left transition-colors"
            [class]="active ? 'bg-accent/12' : 'bg-white/5 hover:bg-white/8'"
            [attr.aria-checked]="active"
            (click)="choice.set(option.value)"
          >
            <shelfy-icon
              [name]="option.icon"
              size="24"
              class="mt-px shrink-0"
              [class]="active ? 'text-accent' : 'text-text-muted'"
            />
            <span class="min-w-0 flex-1">
              <span class="block text-base font-semibold">{{
                'studio.visibility.' + keyFor(option.key) | translate
              }}</span>
              <span class="text-text-muted mt-0.5 block text-sm leading-[1.45]">{{
                'studio.visibility.' + keyFor(option.key) + '_hint' | translate
              }}</span>
            </span>
          </button>
        }
      </div>
      <div dialogFooter class="contents">
        <button type="button" [class]="secondary" (click)="closed.emit()">
          {{ 'lists.cancel' | translate }}
        </button>
        <button type="button" [class]="primary" (click)="published.emit(choice())">
          {{ primaryKey() | translate }}
        </button>
      </div>
    </shelfy-dialog>
  `,
})
export class PublishDialogComponent {
  readonly open = input(false);
  readonly current = input<CollectionVisibility>('private');
  readonly shared = input(false);
  readonly closed = output<void>();
  readonly published = output<CollectionVisibility>();

  readonly visibilities = VISIBILITIES;
  readonly choice = signal<CollectionVisibility>('public');
  readonly primary = buttonClasses({ variant: 'primary' });
  readonly secondary = buttonClasses({ variant: 'secondary' });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const current = untracked(this.current);
      this.choice.set(current === 'private' ? 'public' : current);
    });
  }

  keyFor(key: string): string {
    return key === 'private' && this.shared() ? 'private_shared' : key;
  }

  readonly primaryKey = computed(() => {
    if (this.current() !== 'private') return 'studio.save_visibility';
    return this.choice() === 'private' ? 'studio.keep_private' : 'studio.publish';
  });
}
