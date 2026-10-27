type LetterboxdImportJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface LetterboxdImportStatus {
  jobId: string;
  status: LetterboxdImportJobStatus;
  entriesTotal: number;
  entriesImported: number;
  entriesSkipped: number;
  errorMessage: string | null;
}

type LetterboxdImportEntryStatus = 'imported' | 'skipped';

export interface LetterboxdImportEntry {
  letterboxdTitle: string;
  letterboxdYear: number | null;
  status: LetterboxdImportEntryStatus;
  reason: string | null;
  reasonDetail: string | null;
}
