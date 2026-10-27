import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '@env';
import type { MediaType, PagedResponse } from '@app/core/services/collection/collection.model';
import type { FollowedMediaActivity, UserSearchResultResponse } from './people.model';

@Injectable({
  providedIn: 'root',
})
export class PeopleService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.baseUrl}/people`;

  search(query: string, page = 0, size = 20): Observable<PagedResponse<UserSearchResultResponse>> {
    const params = new HttpParams().set('query', query).set('page', page).set('size', size);
    return this.http.get<PagedResponse<UserSearchResultResponse>>(`${this.baseUrl}/search`, {
      params,
    });
  }

  onMedia(
    provider: string,
    mediaType: MediaType,
    externalId: string,
  ): Observable<FollowedMediaActivity[]> {
    return this.http.get<FollowedMediaActivity[]>(`${this.baseUrl}/media`, {
      params: { provider, mediaType, externalId },
    });
  }
}
