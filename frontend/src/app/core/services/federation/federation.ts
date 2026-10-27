import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, of, shareReplay, type Observable } from 'rxjs';
import { environment } from '@env';
import { LegalService } from '../legal/legal';

export interface MigrationStatus {
  actor: string;
  alias: string | null;
  movedTo: string | null;
}

@Injectable({ providedIn: 'root' })
export class FederationService {
  private readonly http = inject(HttpClient);
  private readonly legal = inject(LegalService);
  private readonly baseUrl = `${environment.baseUrl}/federation`;

  private readonly enabled$ = this.legal.getInfo().pipe(
    map((info) => info.isFederationEnabled === true),
    catchError(() => of(false)),
    shareReplay(1),
  );

  enabled(): Observable<boolean> {
    return this.enabled$;
  }

  migration(): Observable<MigrationStatus> {
    return this.http.get<MigrationStatus>(`${this.baseUrl}/migration`);
  }

  setAlias(handle: string): Observable<MigrationStatus> {
    return this.http.put<MigrationStatus>(`${this.baseUrl}/migration/alias`, { handle });
  }

  clearAlias(): Observable<MigrationStatus> {
    return this.http.delete<MigrationStatus>(`${this.baseUrl}/migration/alias`);
  }

  moveTo(handle: string): Observable<MigrationStatus> {
    return this.http.post<MigrationStatus>(`${this.baseUrl}/migration/move`, { handle });
  }

  remoteFollowUrl(handle: string, username: string): Observable<{ url: string }> {
    const params = new HttpParams().set('handle', handle).set('username', username);
    return this.http.get<{ url: string }>(`${this.baseUrl}/remote-follow`, { params });
  }
}
