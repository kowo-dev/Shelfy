import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '@env';
import type { SteamAuthorizeUrlResponse, SteamImportEntry, SteamImportStatus } from './steam.model';

@Injectable({ providedIn: 'root' })
export class SteamService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.baseUrl}/steam`;

  getAuthorizeUrl(): Observable<SteamAuthorizeUrlResponse> {
    return this.http.get<SteamAuthorizeUrlResponse>(`${this.baseUrl}/oauth/authorize`);
  }

  disconnect(): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/connection`);
  }

  startImport(): Observable<SteamImportStatus> {
    return this.http.post<SteamImportStatus>(`${this.baseUrl}/import`, {});
  }

  getImportStatus(jobId: string): Observable<SteamImportStatus> {
    return this.http.get<SteamImportStatus>(`${this.baseUrl}/import/${jobId}`);
  }

  getLatestImport(): Observable<SteamImportStatus> {
    return this.http.get<SteamImportStatus>(`${this.baseUrl}/import/latest`);
  }

  getImportEntries(jobId: string): Observable<SteamImportEntry[]> {
    return this.http.get<SteamImportEntry[]>(`${this.baseUrl}/import/${jobId}/entries`);
  }
}
