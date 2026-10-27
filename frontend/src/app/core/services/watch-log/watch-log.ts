import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '@env';
import type { UpsertWatchLogRequest, WatchLogEntry } from './watch-log.model';

@Injectable({ providedIn: 'root' })
export class WatchLogService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.baseUrl}/collection/items`;

  list(itemId: string): Observable<WatchLogEntry[]> {
    return this.http.get<WatchLogEntry[]>(`${this.baseUrl}/${itemId}/watch-log`);
  }

  create(itemId: string, request: UpsertWatchLogRequest): Observable<WatchLogEntry> {
    return this.http.post<WatchLogEntry>(`${this.baseUrl}/${itemId}/watch-log`, request);
  }

  update(itemId: string, logId: string, request: UpsertWatchLogRequest): Observable<WatchLogEntry> {
    return this.http.put<WatchLogEntry>(`${this.baseUrl}/${itemId}/watch-log/${logId}`, request);
  }

  delete(itemId: string, logId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${itemId}/watch-log/${logId}`);
  }
}
