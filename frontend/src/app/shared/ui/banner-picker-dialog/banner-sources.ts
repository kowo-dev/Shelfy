import { firstValueFrom, type Observable } from 'rxjs';
import { AniListService } from '@app/core/services/anilist/anilist';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { IgdbService } from '@app/core/services/igdb/igdb';
import type { SearchResult } from '@app/core/services/search/search.model';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import type { MovieDetail, TvShowDetail } from '@app/core/services/tmdb/tmdb.model';
import type { BannerCandidate, BannerImage } from './banner-picker-dialog';

export interface BannerSourceServices {
  tmdb: TmdbService;
  igdb: IgdbService;
  aniList: AniListService;
}

type LabelledImage = [url: string | null, label: string];

function toBannerImages(entries: LabelledImage[]): BannerImage[] {
  const seen = new Set<string>();
  return entries.flatMap(([url, label]) => {
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [{ url, label }];
  });
}

export function createBannerSources({ tmdb, igdb, aniList }: BannerSourceServices) {
  const labelled = (ids: string[], label: string): LabelledImage[] =>
    ids.map((imageId) => [igdb.imageUrl(imageId, 't_1080p'), label]);

  async function imagesForMedia(result: SearchResult): Promise<BannerImage[]> {
    const id = Number(result.externalId);
    switch (result.mediaType) {
      case 'movie':
      case 'tv_show': {
        const detail$: Observable<MovieDetail | TvShowDetail> =
          result.mediaType === 'movie' ? tmdb.getMovie(id) : tmdb.getTvShow(id);
        const media = await firstValueFrom(detail$);
        return toBannerImages(
          [media.backdropPath, ...media.backdropImagePaths].map((path) => [
            tmdb.imageUrl(path, 'original'),
            'Backdrop',
          ]),
        );
      }
      case 'game': {
        const media = await firstValueFrom(igdb.getGame(id));
        return toBannerImages([
          ...labelled(media.screenshotImageIds, 'Screenshot'),
          ...labelled(media.artworkImageIds, 'Artwork'),
        ]);
      }
      case 'anime': {
        const media = await firstValueFrom(aniList.getAnime(id));
        return toBannerImages([[media.bannerImageUrl, 'Banner']]);
      }
      case 'manga':
      case 'webtoon': {
        const media = await firstValueFrom(aniList.getManga(id));
        return toBannerImages([[media.bannerImageUrl, 'Banner']]);
      }
      case 'book':
        return [];
    }
  }

  function coverUrl(result: SearchResult): string | null {
    if (result.provider === 'tmdb') return tmdb.imageUrl(result.posterPath, 'w780');
    if (result.provider === 'igdb') return igdb.imageUrl(result.posterPath, 't_1080p');
    return result.posterPath;
  }

  return { imagesForMedia, coverUrl };
}

export function mediaSourceUrl(result: SearchResult): string {
  switch (result.provider) {
    case 'tmdb':
      return `https://www.themoviedb.org/${result.mediaType === 'movie' ? 'movie' : 'tv'}/${result.externalId}`;
    case 'igdb':
      return `https://www.igdb.com/games/${result.externalId}`;
    case 'anilist':
      return `https://anilist.co/${result.mediaType === 'anime' ? 'anime' : 'manga'}/${result.externalId}`;
    default:
      return 'https://shelfy.app';
  }
}

export function toShelfCandidates(items: readonly CollectionItemResponse[]): BannerCandidate[] {
  return items
    .filter(({ media }) => media.mediaType !== 'book' && !media.isAdult)
    .map(({ media }) => ({
      result: {
        provider: media.provider,
        mediaType: media.mediaType,
        externalId: media.externalId,
        title: media.title,
        posterPath: media.coverUrl,
        overview: '',
        releaseYear: null,
        genres: [],
        voteAverage: null,
        voteCount: null,
        status: null,
        isInCollection: true,
      },
      coverUrl: media.coverUrl,
    }));
}
