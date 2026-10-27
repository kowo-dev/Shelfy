import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  CompanyDetail,
  FranchiseDetail,
  GameDetail,
  GameSummary,
  IgdbImageSize,
  MediaPageResponse,
} from './igdb.model';

const IGDB_IMAGE_BASE_URL = 'https://images.igdb.com/igdb/image/upload/';

@Injectable({ providedIn: 'root' })
export class IgdbService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.baseUrl}/igdb`;

  getGame(id: number): Observable<GameDetail> {
    return this.http.get<GameDetail>(`${this.baseUrl}/games/${id}`);
  }

  getCompany(id: number): Observable<CompanyDetail> {
    return this.http.get<CompanyDetail>(`${this.baseUrl}/companies/${id}`);
  }

  getCompanyGames(id: number, page = 0): Observable<MediaPageResponse<GameSummary>> {
    return this.http.get<MediaPageResponse<GameSummary>>(`${this.baseUrl}/companies/${id}/games`, {
      params: new HttpParams().set('page', page),
    });
  }

  getFranchise(id: number): Observable<FranchiseDetail> {
    return this.http.get<FranchiseDetail>(`${this.baseUrl}/franchises/${id}`);
  }

  getFranchiseGames(id: number, page = 0): Observable<MediaPageResponse<GameSummary>> {
    return this.http.get<MediaPageResponse<GameSummary>>(`${this.baseUrl}/franchises/${id}/games`, {
      params: new HttpParams().set('page', page),
    });
  }

  getGamesByGenre(genreId: number, page = 0): Observable<MediaPageResponse<GameSummary>> {
    return this.http.get<MediaPageResponse<GameSummary>>(
      `${this.baseUrl}/games/by-genre/${genreId}`,
      { params: new HttpParams().set('page', page) },
    );
  }

  getGamesByPlatform(platformId: number, page = 0): Observable<MediaPageResponse<GameSummary>> {
    return this.http.get<MediaPageResponse<GameSummary>>(
      `${this.baseUrl}/games/by-platform/${platformId}`,
      { params: new HttpParams().set('page', page) },
    );
  }

  getGamesByTheme(themeId: number, page = 0): Observable<MediaPageResponse<GameSummary>> {
    return this.http.get<MediaPageResponse<GameSummary>>(
      `${this.baseUrl}/games/by-theme/${themeId}`,
      { params: new HttpParams().set('page', page) },
    );
  }

  getGamesByGameMode(gameModeId: number, page = 0): Observable<MediaPageResponse<GameSummary>> {
    return this.http.get<MediaPageResponse<GameSummary>>(
      `${this.baseUrl}/games/by-game-mode/${gameModeId}`,
      { params: new HttpParams().set('page', page) },
    );
  }

  imageUrl(imageId: string | null, size: IgdbImageSize): string | null {
    return imageId ? `${IGDB_IMAGE_BASE_URL}${size}/${imageId}.jpg` : null;
  }
}
