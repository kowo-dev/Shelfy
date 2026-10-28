import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { type Params, RouterLink } from '@angular/router';
import { TranslateService } from '@app/core/services/translate/translate';
import { IconComponent } from '@shared/ui/icon/icon';

export interface BackTarget {
  to: string | readonly unknown[];
  query?: Params | null;
  label?: string | null;
}

export function exploreBack(type: string | null, label: string): BackTarget {
  return { to: ['/explore'], query: type ? { type } : null, label };
}

export const BACK_BUTTON =
  'bg-button-secondary text-text hover:bg-button-secondary-hover duration-base inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full backdrop-blur-xl transition-[background-color,scale] active:scale-95';

@Component({
  selector: 'shelfy-back-link',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  host: { class: 'col-span-full mb-5 flex md:mb-7' },
  template: `
    <a
      [routerLink]="target().to"
      [queryParams]="target().query ?? null"
      [class]="button"
      [attr.aria-label]="name()"
      [title]="name()"
    >
      <shelfy-icon name="chevronLeft" size="22" />
    </a>
  `,
})
export class BackLinkComponent {
  private readonly translate = inject(TranslateService);

  readonly target = input.required<BackTarget>();

  protected readonly button = BACK_BUTTON;
  protected readonly name = computed(() => {
    this.translate.lang();
    const label = this.target().label;
    return label
      ? this.translate.get('nav.back_to', { page: label })
      : this.translate.get('nav.back');
  });
}
