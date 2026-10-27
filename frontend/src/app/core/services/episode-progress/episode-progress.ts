import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '@env';
import type { MediaType } from '../collection/collection.model';
import type {
  EpisodeCommunity,
  EpisodeProgress,
  RateEpisodeRequest,
  UpdateEpisodeProgressRequest,
} from './episode-progress.model';

@Injectable({ providedIn: 'root' })
export class EpisodeProgressService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.baseUrl}/collection/items`;

  get(itemId: string): Observable<EpisodeProgress> {
    return this.http.get<EpisodeProgress>(`${this.baseUrl}/${itemId}/episodes`);
  }

  update(itemId: string, request: UpdateEpisodeProgressRequest): Observable<EpisodeProgress> {
    return this.http.put<EpisodeProgress>(`${this.baseUrl}/${itemId}/episodes`, request);
  }

  rate(itemId: string, request: RateEpisodeRequest): Observable<EpisodeProgress> {
    return this.http.put<EpisodeProgress>(`${this.baseUrl}/${itemId}/episodes/rating`, request);
  }

  markAll(itemId: string, watched: boolean): Observable<EpisodeProgress> {
    return this.http.put<EpisodeProgress>(`${this.baseUrl}/${itemId}/episodes/all`, {
      isWatched: watched,
    });
  }

  community(
    provider: string,
    mediaType: MediaType,
    externalId: string,
  ): Observable<EpisodeCommunity> {
    return this.http.get<EpisodeCommunity>(`${environment.baseUrl}/episodes/community`, {
      params: { provider, mediaType, externalId },
    });
  }
}
