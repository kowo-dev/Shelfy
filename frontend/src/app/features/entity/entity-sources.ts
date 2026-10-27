import { forkJoin, map, type Observable } from 'rxjs';
import { AniListService } from '@app/core/services/anilist/anilist';
import type { AniListEntityMedia } from '@app/core/services/anilist/anilist.model';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import type { DiscoverCategory } from '@app/core/services/discover/discover.model';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { buildPreviewItem } from '@app/features/discover/data-access/discover-preview.util';
import type {
  EntityGame,
  EntityItemsPage,
  EntityKind,
  EntityPageData,
  EntitySource,
} from './entity.model';

export interface EntityServices {
  tmdb: TmdbService;
  igdb: IgdbService;
  anilist: AniListService;
}

type Sources = Partial<Record<EntityKind, EntitySource>>;

export function previewItem(
  type: DiscoverCategory,
  id: number | string,
  title: string,
  coverUrl: string | null,
  rating: number | null = null,
  role: string | null = null,
): CollectionItemResponse {
  return buildPreviewItem(type, id, title, coverUrl, rating, null, role ? { role } : {});
}

export function createEntitySources(services: EntityServices): Record<EntityKind, EntitySource> {
  return {
    ...tmdbSources(services.tmdb),
    ...aniListSources(services.anilist),
    ...igdbSources(services.igdb),
  } as Record<EntityKind, EntitySource>;
}

function tmdbSources(tmdb: TmdbService): Sources {
  const tvPreview = (show: {
    id: number;
    name: string;
    posterPath: string | null;
    voteAverage: number;
  }) =>
    previewItem(
      'tv_show',
      show.id,
      show.name,
      tmdb.imageUrl(show.posterPath, 'w342'),
      show.voteAverage,
    );

  function companyMedia(id: string, page: number): Observable<EntityItemsPage> {
    return forkJoin({
      movies: tmdb.getCompanyMovies(Number(id), page + 1),
      tv: tmdb.getCompanyTv(Number(id), page + 1),
    }).pipe(
      map(({ movies, tv }) => ({
        items: [
          ...movies.results.map((movie) =>
            previewItem(
              'movie',
              movie.id,
              movie.title,
              tmdb.imageUrl(movie.posterPath, 'w342'),
              movie.voteAverage,
            ),
          ),
          ...tv.results.map(tvPreview),
        ],
        hasMore: movies.page < movies.totalPages || tv.page < tv.totalPages,
      })),
    );
  }

  function networkTv(id: string, page: number): Observable<EntityItemsPage> {
    return tmdb.getNetworkTv(Number(id), page + 1).pipe(
      map((tv) => ({
        items: tv.results.map(tvPreview),
        hasMore: tv.page < tv.totalPages,
      })),
    );
  }

  return {
    people: {
      load: (id) =>
        tmdb.getPerson(Number(id)).pipe(
          map((person) => ({
            header: {
              name: person.name,
              description: person.biography,
              imageUrl: tmdb.imageUrl(person.profilePath, 'w185'),
              subtitle: person.birthday,
              icon: 'user',
            },
            items: [],
            hasMore: false,
            credits: person.credits,
          })),
        ),
    },
    companies: {
      load: (id) =>
        forkJoin({ company: tmdb.getCompany(Number(id)), page: companyMedia(id, 0) }).pipe(
          map(({ company, page }) => ({
            header: {
              name: company.name,
              description: company.description ?? '',
              subtitle: company.headquarters,
              icon: 'grid',
            },
            ...page,
          })),
        ),
      more: companyMedia,
    },
    networks: {
      load: (id) =>
        forkJoin({ network: tmdb.getNetwork(Number(id)), page: networkTv(id, 0) }).pipe(
          map(({ network, page }) => ({
            header: {
              name: network.name,
              description: network.description ?? '',
              subtitle: network.headquarters,
              icon: 'tv',
            },
            ...page,
          })),
        ),
      more: networkTv,
    },
  };
}

function aniListSources(anilist: AniListService): Sources {
  const preview = (media: AniListEntityMedia) =>
    previewItem(
      media.mediaType as DiscoverCategory,
      media.id,
      media.title,
      media.coverImageUrl,
      media.rating,
    );

  const page = (detail: {
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    media: AniListEntityMedia[];
  }): EntityPageData => ({
    header: {
      name: detail.name,
      description: detail.description ?? undefined,
      imageUrl: detail.imageUrl,
      icon: 'user',
    },
    items: detail.media.map(preview),
    hasMore: false,
  });

  return {
    staff: { load: (id) => anilist.getStaff(Number(id)).pipe(map(page)) },
    characters: { load: (id) => anilist.getCharacter(Number(id)).pipe(map(page)) },
    studios: {
      load: (id) =>
        anilist.getStudio(Number(id)).pipe(
          map((studio) => ({
            header: { name: studio.name, icon: 'grid' },
            items: studio.media.map(preview),
            hasMore: false,
          })),
        ),
    },
  };
}

function igdbSources(igdb: IgdbService): Sources {
  const gamePage = (
    request: Observable<{ content: readonly EntityGame[]; hasMore: boolean }>,
  ): Observable<EntityItemsPage> =>
    request.pipe(
      map((page) => ({
        items: page.content.map((game) =>
          previewItem(
            'game',
            game.id,
            game.name,
            igdb.imageUrl(game.coverImageId, 't_1080p'),
            game.rating,
          ),
        ),
        hasMore: page.hasMore,
      })),
    );

  return {
    'game-companies': {
      load: (id) =>
        forkJoin({
          company: igdb.getCompany(Number(id)),
          page: gamePage(igdb.getCompanyGames(Number(id), 0)),
        }).pipe(
          map(({ company, page }) => ({
            header: {
              name: company.name,
              description: company.description,
              imageUrl: igdb.imageUrl(company.logoImageId, 't_cover_big'),
              icon: 'grid',
            },
            ...page,
          })),
        ),
      more: (id, page) => gamePage(igdb.getCompanyGames(Number(id), page)),
    },
    franchises: {
      load: (id) =>
        forkJoin({
          franchise: igdb.getFranchise(Number(id)),
          page: gamePage(igdb.getFranchiseGames(Number(id), 0)),
        }).pipe(
          map(({ franchise, page }) => ({
            header: { name: franchise.name, icon: 'game' },
            ...page,
          })),
        ),
      more: (id, page) => gamePage(igdb.getFranchiseGames(Number(id), page)),
    },
  };
}
