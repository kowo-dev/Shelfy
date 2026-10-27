import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@app/shared/ui/icon/icon';
import { SpinnerComponent } from '@app/shared/ui/spinner/spinner';

export interface ImportSummary {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  imported: number;
  skipped: number;
  total: number;
}

export interface ImportRow {
  key: string | number;
  name: string;
  reason?: string | null;
  detail?: string | null;
}

@Component({
  selector: 'shelfy-import-progress',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IconComponent, SpinnerComponent],
  templateUrl: './import-progress.html',
  host: { class: 'flex flex-col gap-3', 'aria-live': 'polite' },
})
export class ImportProgressComponent {
  readonly detailsToggle =
    'text-text-muted hover:text-text flex w-fit cursor-pointer items-center gap-1.5 rounded-xs text-sm font-medium transition-colors outline-offset-2';
  private readonly translate = inject(TranslateService);

  prefix = input.required<string>();
  summary = input.required<ImportSummary>();
  active = input.required<boolean>();
  progress = input.required<number>();
  expanded = input.required<boolean>();
  loading = input.required<boolean>();
  entryCount = input<number | null>(null);
  skipped = input.required<ImportRow[]>();
  imported = input.required<ImportRow[]>();

  toggleDetails = output<void>();

  reasonLabel(reason: string | null | undefined): string {
    if (!reason) return '';
    const key = `${this.prefix()}.reasons.${reason}`;
    const label = this.translate.get(key);
    return label === key ? reason : label;
  }
}
