import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '@env';
import type { CommunityQuery, FeedPage } from './community.model';

export function communityParams(page: number, size: number, query: CommunityQuery): HttpParams {
  let params = new HttpParams().set('page', page).set('size', size);
  const q = query.q?.trim();
  if (q) params = params.set('q', q);
  if (query.scope) params = params.set('scope', query.scope);
  if (query.sort) params = params.set('sort', query.sort);
  if (query.mediaType) params = params.set('mediaType', query.mediaType);
  return params;
}

@Injectable({ providedIn: 'root' })
export class FeedService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.baseUrl}/feed`;

  page(before: string | null = null, size = 20): Observable<FeedPage> {
    let params = new HttpParams().set('size', size);
    if (before) params = params.set('before', before);
    return this.http.get<FeedPage>(this.baseUrl, { params });
  }

  unread(since: string): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.baseUrl}/unread`, { params: { since } });
  }
}
