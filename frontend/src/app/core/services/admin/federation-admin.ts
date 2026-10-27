import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '@env';
import type { FederationOverview, FederationReport } from './federation-admin.model';

@Injectable({ providedIn: 'root' })
export class FederationAdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.baseUrl}/admin/federation`;

  overview(): Observable<FederationOverview> {
    return this.http.get<FederationOverview>(`${this.baseUrl}/overview`);
  }

  reports(): Observable<FederationReport[]> {
    return this.http.get<FederationReport[]>(`${this.baseUrl}/reports`);
  }

  retryDeliveries(domain: string): Observable<{ retried: number }> {
    return this.http.post<{ retried: number }>(
      `${this.baseUrl}/deliveries/${encodeURIComponent(domain)}/retry`,
      {},
    );
  }

  block(domain: string, reason: string | null): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/domain-blocks/${encodeURIComponent(domain)}`, {
      reason,
    });
  }

  unblock(domain: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/domain-blocks/${encodeURIComponent(domain)}`);
  }

  allow(domain: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/domain-allows/${encodeURIComponent(domain)}`, {});
  }

  disallow(domain: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/domain-allows/${encodeURIComponent(domain)}`);
  }
}
