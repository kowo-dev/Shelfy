import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type TagVariant = 'accent' | 'muted' | 'solid';
export type TagSize = 'sm' | 'md';

@Component({
  selector: 'shelfy-tag',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="classes()"><ng-content /></span>`,
})
export class TagComponent {
  variant = input<TagVariant>('accent');
  size = input<TagSize>('sm');

  readonly classes = computed(() => {
    const colors = {
      accent: 'bg-fill text-text',
      muted: 'bg-fill-subtle text-text-muted',
      solid: 'bg-accent text-surface',
    }[this.variant()];
    const sizing = this.size() === 'md' ? 'px-2 py-1 text-sm' : 'px-1.5 py-0.5 text-xs';
    return `${colors} rounded-sm font-medium ${sizing}`;
  });
}
