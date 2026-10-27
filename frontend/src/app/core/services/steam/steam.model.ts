export interface SteamAuthorizeUrlResponse {
  url: string;
}

type SteamImportJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface SteamImportStatus {
  jobId: string;
  status: SteamImportJobStatus;
  gamesTotal: number;
  gamesImported: number;
  gamesSkipped: number;
  errorMessage: string | null;
}

type SteamImportEntryStatus = 'imported' | 'skipped';

export interface SteamImportEntry {
  steamAppId: number;
  steamName: string;
  status: SteamImportEntryStatus;
  reason: string | null;
  reasonDetail: string | null;
  igdbName: string | null;
}
