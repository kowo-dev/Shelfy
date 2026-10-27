import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  CompanyDetail,
  MovieDetail,
  MovieSummary,
  PersonDetail,
  SeasonDetail,
  TmdbImageSize,
  TmdbSearchResponse,
  TvShowDetail,
  TvShowSummary,
} from './tmdb.model';

@Injectable({ providedIn: 'root' })
export class TmdbService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.baseUrl}/tmdb`;

  getMovie(id: number): Observable<MovieDetail> {
    return this.http.get<MovieDetail>(`${this.baseUrl}/movies/${id}`);
  }

  getTvShow(id: number): Observable<TvShowDetail> {
    return this.http.get<TvShowDetail>(`${this.baseUrl}/tv/${id}`);
  }

  getTvSeason(tvId: number, seasonNumber: number): Observable<SeasonDetail> {
    return this.http.get<SeasonDetail>(`${this.baseUrl}/tv/${tvId}/seasons/${seasonNumber}`);
  }

  getPerson(id: number): Observable<PersonDetail> {
    return this.http.get<PersonDetail>(`${this.baseUrl}/people/${id}`);
  }

  getCompany(id: number): Observable<CompanyDetail> {
    return this.http.get<CompanyDetail>(`${this.baseUrl}/companies/${id}`);
  }

  getCompanyMovies(id: number, page = 1): Observable<TmdbSearchResponse<MovieSummary>> {
    return this.http.get<TmdbSearchResponse<MovieSummary>>(
      `${this.baseUrl}/companies/${id}/movies`,
      { params: new HttpParams().set('page', page) },
    );
  }

  getCompanyTv(id: number, page = 1): Observable<TmdbSearchResponse<TvShowSummary>> {
    return this.http.get<TmdbSearchResponse<TvShowSummary>>(`${this.baseUrl}/companies/${id}/tv`, {
      params: new HttpParams().set('page', page),
    });
  }

  getNetwork(id: number): Observable<CompanyDetail> {
    return this.http.get<CompanyDetail>(`${this.baseUrl}/networks/${id}`);
  }

  getNetworkTv(id: number, page = 1): Observable<TmdbSearchResponse<TvShowSummary>> {
    return this.http.get<TmdbSearchResponse<TvShowSummary>>(`${this.baseUrl}/networks/${id}/tv`, {
      params: new HttpParams().set('page', page),
    });
  }

  getMoviesByGenre(genreId: number, page = 1): Observable<TmdbSearchResponse<MovieSummary>> {
    return this.http.get<TmdbSearchResponse<MovieSummary>>(
      `${this.baseUrl}/movies/by-genre/${genreId}`,
      { params: new HttpParams().set('page', page) },
    );
  }

  getTvShowsByGenre(genreId: number, page = 1): Observable<TmdbSearchResponse<TvShowSummary>> {
    return this.http.get<TmdbSearchResponse<TvShowSummary>>(
      `${this.baseUrl}/tv/by-genre/${genreId}`,
      { params: new HttpParams().set('page', page) },
    );
  }

  imageUrl(path: string | null, size: TmdbImageSize): string | null {
    return path ? `${environment.tmdbImageBaseUrl}${size}${path}` : null;
  }
}
