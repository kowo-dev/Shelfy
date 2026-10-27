import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type {
  LetterboxdImportEntry,
  LetterboxdImportStatus,
} from '@app/core/services/letterboxd/letterboxd.model';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { SpinnerComponent } from '@app/shared/ui/spinner/spinner';
import { buttonClasses } from '@shared/ui/button/button';
import { ImportCardShellComponent } from '../import-card-shell/import-card-shell';
import { ImportProgressComponent, type ImportRow } from '../import-progress/import-progress';

function toRow(entry: LetterboxdImportEntry): ImportRow {
  return {
    key: entry.letterboxdTitle + entry.letterboxdYear,
    name: entry.letterboxdTitle,
    reason: entry.reason,
  };
}

@Component({
  selector: 'shelfy-letterboxd-import-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, SpinnerComponent, ImportProgressComponent, ImportCardShellComponent],
  templateUrl: './letterboxd-import-card.html',
  host: { class: 'block' },
})
export class LetterboxdImportCardComponent {
  readonly pill = buttonClasses({ variant: 'secondary' });

  covers = input<string[]>([]);
  importStarting = input.required<boolean>();
  importActive = input.required<boolean>();
  importStatus = input<LetterboxdImportStatus | null>(null);
  importProgress = input.required<number>();
  entriesExpanded = input.required<boolean>();
  entriesLoading = input.required<boolean>();
  entries = input<LetterboxdImportEntry[] | null>(null);
  skippedEntries = input.required<LetterboxdImportEntry[]>();
  importedEntries = input.required<LetterboxdImportEntry[]>();

  readonly summary = computed(() => {
    const status = this.importStatus();
    return (
      status && {
        status: status.status,
        imported: status.entriesImported,
        skipped: status.entriesSkipped,
        total: status.entriesTotal,
      }
    );
  });
  readonly skippedRows = computed(() => this.skippedEntries().map(toRow));
  readonly importedRows = computed(() => this.importedEntries().map(toRow));

  fileSelected = output<File>();
  toggleEntries = output<void>();

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      this.fileSelected.emit(file);
    }
  }
}
