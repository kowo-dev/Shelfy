import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  AnimeDetail,
  BrowseMediaResult,
  CharacterDetail,
  MangaDetail,
  StaffDetail,
  StudioDetail,
} from './anilist.model';

@Injectable({ providedIn: 'root' })
export class AniListService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.baseUrl}/anilist`;

  getAnime(id: number): Observable<AnimeDetail> {
    return this.http.get<AnimeDetail>(`${this.baseUrl}/anime/${id}`);
  }

  getManga(id: number): Observable<MangaDetail> {
    return this.http.get<MangaDetail>(`${this.baseUrl}/manga/${id}`);
  }

  getStaff(id: number): Observable<StaffDetail> {
    return this.http.get<StaffDetail>(`${this.baseUrl}/staff/${id}`);
  }

  getCharacter(id: number): Observable<CharacterDetail> {
    return this.http.get<CharacterDetail>(`${this.baseUrl}/characters/${id}`);
  }

  getStudio(id: number): Observable<StudioDetail> {
    return this.http.get<StudioDetail>(`${this.baseUrl}/studios/${id}`);
  }

  browseByGenre(
    mediaType: string,
    genre: string,
    page = 1,
    countryOfOrigin?: string,
  ): Observable<BrowseMediaResult> {
    let params = new HttpParams().set('mediaType', mediaType).set('genre', genre).set('page', page);
    if (countryOfOrigin) {
      params = params.set('countryOfOrigin', countryOfOrigin);
    }
    return this.http.get<BrowseMediaResult>(`${this.baseUrl}/media/by-genre`, { params });
  }

  browseByTag(
    mediaType: string,
    tag: string,
    page = 1,
    countryOfOrigin?: string,
  ): Observable<BrowseMediaResult> {
    let params = new HttpParams().set('mediaType', mediaType).set('tag', tag).set('page', page);
    if (countryOfOrigin) {
      params = params.set('countryOfOrigin', countryOfOrigin);
    }
    return this.http.get<BrowseMediaResult>(`${this.baseUrl}/media/by-tag`, { params });
  }
}
