import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '@env';
import type { MediaType } from '@app/core/services/collection/collection.model';
import type { RelatedMediaResponse, SimilarMediaResponse } from './related.model';

@Injectable({ providedIn: 'root' })
export class RelatedMediaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.baseUrl}/media`;

  getRelated(mediaType: MediaType, externalId: number | string): Observable<RelatedMediaResponse> {
    return this.http.get<RelatedMediaResponse>(
      `${this.baseUrl}/${mediaType}/${encodeURIComponent(externalId)}/related`,
    );
  }

  getSimilar(
    mediaType: MediaType,
    externalId: number | string,
    page: number,
  ): Observable<SimilarMediaResponse> {
    const params = new HttpParams().set('page', page);
    return this.http.get<SimilarMediaResponse>(
      `${this.baseUrl}/${mediaType}/${encodeURIComponent(externalId)}/similar`,
      { params },
    );
  }
}
