import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '@env';
import type { PagedResponse } from '@app/core/services/collection/collection.model';
import type { GameSummary } from '@app/core/services/igdb/igdb.model';
import type { MovieSummary, TvShowSummary } from '@app/core/services/tmdb/tmdb.model';
import type { AnimeSummary, MangaSummary } from '@app/core/services/anilist/anilist.model';
import type { DiscoverFeed } from './discover.model';

@Injectable({ providedIn: 'root' })
export class DiscoverService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.baseUrl}/discover`;

  private paged<T>(
    path: string,
    feed: DiscoverFeed,
    page: number,
    size: number,
  ): Observable<PagedResponse<T>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PagedResponse<T>>(`${this.baseUrl}/${path}/${feed}`, { params });
  }

  getMovies(
    feed: DiscoverFeed,
    page: number,
    size: number,
  ): Observable<PagedResponse<MovieSummary>> {
    return this.paged('movies', feed, page, size);
  }

  getSeries(
    feed: DiscoverFeed,
    page: number,
    size: number,
  ): Observable<PagedResponse<TvShowSummary>> {
    return this.paged('series', feed, page, size);
  }

  getGames(feed: DiscoverFeed, page: number, size: number): Observable<PagedResponse<GameSummary>> {
    return this.paged('games', feed, page, size);
  }

  getAnime(
    feed: DiscoverFeed,
    page: number,
    size: number,
  ): Observable<PagedResponse<AnimeSummary>> {
    return this.paged('anime', feed, page, size);
  }

  getManga(
    feed: DiscoverFeed,
    page: number,
    size: number,
  ): Observable<PagedResponse<MangaSummary>> {
    return this.paged('manga', feed, page, size);
  }

  getWebtoons(
    feed: DiscoverFeed,
    page: number,
    size: number,
  ): Observable<PagedResponse<MangaSummary>> {
    return this.paged('webtoons', feed, page, size);
  }
}
