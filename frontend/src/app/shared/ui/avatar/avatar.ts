import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type AvatarSize = '28' | '32' | '40' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<AvatarSize, string> = {
  '28': 'size-7',
  '32': 'size-8',
  '40': 'size-10',
  sm: 'size-9',
  md: 'size-11',
  lg: 'size-16',
  xl: 'size-24',
};

@Component({
  selector: 'shelfy-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (avatarUrl()) {
      <img [src]="avatarUrl()" [alt]="displayName()" class="size-full rounded-full object-cover" />
    } @else {
      <span
        class="font-display flex size-full items-center justify-center rounded-full bg-[#e9e4dc] font-extrabold text-[#141110]"
        [class]="textClass()"
      >
        {{ initials() }}
      </span>
    }
  `,
  host: {
    '[class]': 'hostClass()',
  },
})
export class AvatarComponent {
  displayName = input.required<string>();
  avatarUrl = input<string | null>(null);
  size = input<AvatarSize>('sm');

  hostClass = computed(() => `inline-block shrink-0 ${SIZE_CLASS[this.size()]}`);
  textClass = computed(() =>
    this.size() === 'lg' || this.size() === 'xl'
      ? 'text-xl'
      : this.size() === '28'
        ? 'text-xs'
        : 'text-xs',
  );

  initials = computed(() => {
    const name = this.displayName() ?? '';
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  });
}
