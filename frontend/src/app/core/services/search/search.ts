import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '@env';
import type { MediaType } from '@app/core/services/collection/collection.model';
import type {
  ExploreOption,
  ExploreResponse,
  ExploreVocabulary,
  SearchResponse,
} from './search.model';
import { exploreApiParams, type ExploreQuery } from './explore-query';

export interface SearchApiFilters {
  type?: MediaType | null;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.baseUrl}/search`;

  search(query: string, page = 1, filters: SearchApiFilters = {}): Observable<SearchResponse> {
    let params = new HttpParams().set('query', query).set('page', page);
    if (filters.type) params = params.set('type', filters.type);
    return this.http.get<SearchResponse>(this.baseUrl, { params });
  }

  explore(query: ExploreQuery, page: number, region: string): Observable<ExploreResponse> {
    let params = new HttpParams().set('page', page).set('region', region);
    for (const [key, value] of exploreApiParams(query)) params = params.append(key, value);
    return this.http.get<ExploreResponse>(`${this.baseUrl}/explore`, { params });
  }

  vocabulary(): Observable<ExploreVocabulary> {
    return this.http.get<ExploreVocabulary>(`${this.baseUrl}/vocabulary`);
  }

  streaming(region: string): Observable<ExploreOption[]> {
    return this.http.get<ExploreOption[]>(`${this.baseUrl}/streaming`, {
      params: new HttpParams().set('region', region),
    });
  }

  catalogOptions(type: MediaType, query: string): Observable<ExploreOption[]> {
    return this.http.get<ExploreOption[]>(`${this.baseUrl}/facets`, {
      params: new HttpParams().set('type', type).set('query', query),
    });
  }
}
