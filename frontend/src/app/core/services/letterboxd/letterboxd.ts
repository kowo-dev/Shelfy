import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '@env';
import type { LetterboxdImportEntry, LetterboxdImportStatus } from './letterboxd.model';

@Injectable({ providedIn: 'root' })
export class LetterboxdService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.baseUrl}/letterboxd`;

  startImport(file: File): Observable<LetterboxdImportStatus> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<LetterboxdImportStatus>(`${this.baseUrl}/import`, formData);
  }

  getImportStatus(jobId: string): Observable<LetterboxdImportStatus> {
    return this.http.get<LetterboxdImportStatus>(`${this.baseUrl}/import/${jobId}`);
  }

  getLatestImport(): Observable<LetterboxdImportStatus> {
    return this.http.get<LetterboxdImportStatus>(`${this.baseUrl}/import/latest`);
  }

  getImportEntries(jobId: string): Observable<LetterboxdImportEntry[]> {
    return this.http.get<LetterboxdImportEntry[]>(`${this.baseUrl}/import/${jobId}/entries`);
  }
}
