import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { SteamImportEntry, SteamImportStatus } from '@app/core/services/steam/steam.model';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { SpinnerComponent } from '@app/shared/ui/spinner/spinner';
import { buttonClasses } from '@shared/ui/button/button';
import { ImportCardShellComponent } from '../import-card-shell/import-card-shell';
import { ImportProgressComponent, type ImportRow } from '../import-progress/import-progress';

function toRow(entry: SteamImportEntry): ImportRow {
  return {
    key: entry.steamAppId,
    name: entry.steamName,
    reason: entry.reason,
    detail: entry.igdbName,
  };
}

@Component({
  selector: 'shelfy-steam-import-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, SpinnerComponent, ImportProgressComponent, ImportCardShellComponent],
  templateUrl: './steam-import-card.html',
  host: { class: 'block' },
})
export class SteamImportCardComponent {
  readonly pill = buttonClasses({ variant: 'secondary' });

  covers = input<string[]>([]);
  steamConnected = input.required<boolean>();
  steamDisplayName = input<string | null>(null);
  connecting = input.required<boolean>();
  disconnecting = input.required<boolean>();
  importStarting = input.required<boolean>();
  importActive = input.required<boolean>();
  importStatus = input<SteamImportStatus | null>(null);
  importProgress = input.required<number>();
  entriesExpanded = input.required<boolean>();
  entriesLoading = input.required<boolean>();
  entries = input<SteamImportEntry[] | null>(null);
  skippedEntries = input.required<SteamImportEntry[]>();
  importedEntries = input.required<SteamImportEntry[]>();

  readonly summary = computed(() => {
    const status = this.importStatus();
    return (
      status && {
        status: status.status,
        imported: status.gamesImported,
        skipped: status.gamesSkipped,
        total: status.gamesTotal,
      }
    );
  });
  readonly skippedRows = computed(() => this.skippedEntries().map(toRow));
  readonly importedRows = computed(() => this.importedEntries().map(toRow));

  connect = output<void>();
  disconnect = output<void>();
  startImport = output<void>();
  toggleEntries = output<void>();
}
