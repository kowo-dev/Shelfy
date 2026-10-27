import { signal, type WritableSignal } from '@angular/core';
import { catchError, EMPTY, merge, tap, type Observable, type Subscription } from 'rxjs';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import type { MovieDetail, TvShowDetail } from '@app/core/services/tmdb/tmdb.model';
import { IgdbService } from '@app/core/services/igdb/igdb';
import type { GameDetail } from '@app/core/services/igdb/igdb.model';
import { AniListService } from '@app/core/services/anilist/anilist';
import type { AnimeDetail, MangaDetail } from '@app/core/services/anilist/anilist.model';
import { CollectionService } from '@app/core/services/collection/collection';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { PROVIDER_BY_MEDIA_TYPE, type DetailMediaType } from './media-detail-view.util';

export interface MediaDetailPageDependencies {
  tmdb: TmdbService;
  igdb: IgdbService;
  aniList: AniListService;
  collectionService: CollectionService;
}

export interface MediaDetailPageData {
  loading: WritableSignal<boolean>;
  movie: WritableSignal<MovieDetail | null>;
  tvShow: WritableSignal<TvShowDetail | null>;
  game: WritableSignal<GameDetail | null>;
  animeDetail: WritableSignal<AnimeDetail | null>;
  mangaDetail: WritableSignal<MangaDetail | null>;
  collectionItem: WritableSignal<CollectionItemResponse | null>;
  load: (mediaType: DetailMediaType, externalId: number | string) => void;
}

export function createMediaDetailPage(
  onError: (error: unknown) => void,
  dependencies: MediaDetailPageDependencies,
): MediaDetailPageData {
  const { tmdb, igdb, aniList, collectionService } = dependencies;

  const loading = signal(true);
  const movie = signal<MovieDetail | null>(null);
  const tvShow = signal<TvShowDetail | null>(null);
  const game = signal<GameDetail | null>(null);
  const animeDetail = signal<AnimeDetail | null>(null);
  const mangaDetail = signal<MangaDetail | null>(null);
  const collectionItem = signal<CollectionItemResponse | null>(null);

  let pending: Subscription | null = null;

  function detailRequest(
    mediaType: DetailMediaType,
    externalId: number | string,
  ): Observable<unknown> {
    switch (mediaType) {
      case 'game':
        return igdb.getGame(externalId as number).pipe(tap((detail) => game.set(detail)));
      case 'movie':
        return tmdb.getMovie(externalId as number).pipe(tap((detail) => movie.set(detail)));
      case 'tv_show':
        return tmdb.getTvShow(externalId as number).pipe(tap((detail) => tvShow.set(detail)));
      case 'anime':
        return aniList
          .getAnime(externalId as number)
          .pipe(tap((detail) => animeDetail.set(detail)));
      case 'manga':
      case 'webtoon':
        return aniList
          .getManga(externalId as number)
          .pipe(tap((detail) => mangaDetail.set(detail)));
    }
  }

  function load(mediaType: DetailMediaType, externalId: number | string): void {
    pending?.unsubscribe();
    loading.set(true);
    movie.set(null);
    tvShow.set(null);
    game.set(null);
    animeDetail.set(null);
    mangaDetail.set(null);
    collectionItem.set(null);

    const provider = PROVIDER_BY_MEDIA_TYPE[mediaType];
    pending = merge(
      detailRequest(mediaType, externalId).pipe(
        tap(() => loading.set(false)),
        catchError((error: unknown) => {
          loading.set(false);
          onError(error);
          return EMPTY;
        }),
      ),
      collectionService.lookup(provider, mediaType, String(externalId)).pipe(
        tap((item) => collectionItem.set(item)),
        catchError((error: unknown) => {
          onError(error);
          return EMPTY;
        }),
      ),
    ).subscribe();
  }

  return {
    loading,
    movie,
    tvShow,
    game,
    animeDetail,
    mangaDetail,
    collectionItem,
    load,
  };
}
