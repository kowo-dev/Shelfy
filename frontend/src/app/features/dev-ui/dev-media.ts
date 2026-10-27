import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NEVER, delay, of } from 'rxjs';
import { AniListService } from '@app/core/services/anilist/anilist';
import { AuthService } from '@app/core/services/auth/auth';
import { CollectionService } from '@app/core/services/collection/collection';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { RelatedMediaService } from '@app/core/services/related/related';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { UserProfileService } from '@app/core/services/users/user-profile';
import { WatchLogService } from '@app/core/services/watch-log/watch-log';
import { MediaDetailPageComponent } from '../media-detail/media-detail';

const params = new URLSearchParams(globalThis.location?.search ?? '');
const CASE = params.get('case') ?? 'movie';
const SHELF = params.get('shelf') ?? 'done';
const RELATED_DELAY = Number(params.get('relatedDelay') ?? 0);

const IMG = {
  a: '5Xc7WpWsgflfgEMoBlf9TmWhfbH.jpg',
  b: '5h0EU2lqBb03dp5vtRuUHJwqzem.jpg',
  c: 'euBlF64efQmsl2y54LeNmLQPNob.jpg',
  d: 'axdUor6gLMTrrB1UF4Qfy0TTSyX.jpg',
  e: 'oC2MuEWxnLVTyYw70XoK2HFf7nW.jpg',
  f: 'uRHsiw1wLxPHFXkkv4Ix1s0O6f4.jpg',
  wide: '9faGSFi5jam6pDWGNd0p8JcJgXQ.jpg',
};
const OVERVIEW =
  'A computer hacker learns from mysterious rebels about the true nature of his reality and his role in the war against its controllers. When he is offered a choice between the comfortable lie and the harsh truth, nothing will be the same again, and the cost of waking up is higher than anyone told him.';

const genres = [
  { id: 28, name: 'Action' },
  { id: 878, name: 'Science Fiction' },
];
const cast = [IMG.a, IMG.b, IMG.c, IMG.d, IMG.e, IMG.f].map((path, i) => ({
  id: i + 1,
  name: [
    'Keanu Reeves',
    'Carrie-Anne Moss',
    'Laurence Fishburne',
    'Hugo Weaving',
    'Joe Pantoliano',
    'Gloria Foster',
  ][i],
  character: ['Neo', 'Trinity', 'Morpheus', 'Agent Smith', 'Cypher', 'The Oracle'][i],
  profilePath: `/${path}`,
}));
const company = [{ id: 1, name: 'Warner Bros.', logoPath: null }];

const MOVIE = {
  id: 603,
  title: 'The Matrix',
  originalTitle: 'The Matrix',
  overview: OVERVIEW,
  posterPath: `/${IMG.a}`,
  backdropPath: `/${IMG.wide}`,
  releaseDate: '1999-03-30',
  runtime: 136,
  genres,
  voteAverage: 8.2,
  voteCount: 25120,
  isAdult: false,
  budget: 63000000,
  revenue: 463000000,
  productionCompanies: company,
  director: { id: 9, name: 'Lana Wachowski' },
  backdropImagePaths: [IMG.wide, IMG.b, IMG.c, IMG.d, IMG.e, IMG.f].map((p) => `/${p}`),
  posterImagePaths: [],
  cast,
};

const seasons = [1, 2, 3, 4].map((n) => ({
  seasonNumber: n,
  name: `Season ${n}`,
  episodeCount: 8 + n,
  posterPath: `/${[IMG.b, IMG.c, IMG.d, IMG.e][n - 1]}`,
  airDate: `${2018 + n}-03-01`,
}));
const TV = {
  id: 1396,
  name: 'Breaking Bad',
  originalName: 'Breaking Bad',
  overview: OVERVIEW,
  posterPath: `/${IMG.b}`,
  backdropPath: `/${IMG.wide}`,
  firstAirDate: '2008-01-20',
  numberOfSeasons: 4,
  numberOfEpisodes: 38,
  seasons: CASE === 'tv1' ? seasons.slice(0, 1) : seasons,
  genres: [{ id: 18, name: 'Drama' }],
  voteAverage: 8.9,
  voteCount: 14000,
  productionCompanies: company,
  networks: [{ id: 2, name: 'AMC', logoPath: null }],
  backdropImagePaths: [IMG.wide, IMG.a].map((p) => `/${p}`),
  posterImagePaths: [],
  cast,
  isAdult: false,
};

const SEASON = {
  seasonNumber: 1,
  name: 'Season 1',
  overview: '',
  posterPath: null,
  episodes: [1, 2, 3, 4].map((n) => ({
    episodeNumber: n,
    seasonNumber: 1,
    name: ['Pilot', "Cat's in the Bag...", 'And the Bag is in the River', 'Cancer Man'][n - 1],
    overview:
      'Walter White, a chemistry teacher, discovers he has cancer and decides to cook meth to secure his family.',
    airDate: `2008-0${n}-20`,
    stillPath: `/${[IMG.c, IMG.d, IMG.e, IMG.f][n - 1]}`,
    runtime: 47,
  })),
};

const facet = (id: number, name: string) => ({ id, name });
const gameSummary = (id: number, name: string, img: string) => ({ id, name, coverImageId: img });
const relatedGame = (id: number, title: string, img: string) => ({
  provider: 'igdb',
  mediaType: 'game',
  externalId: String(id),
  title,
  posterPath: img,
  overview: '',
  releaseYear: 2020,
  genres: [],
  voteAverage: null,
  voteCount: null,
  status: null,
  isInCollection: id === 21,
});
const GAME = {
  id: 1145350,
  name: 'Hades II',
  summary: OVERVIEW,
  storyline: 'The immortal Princess of the Underworld sets out to defy the Titan of Time.',
  releaseDate: '2025-09-25',
  coverImageId: IMG.e,
  screenshotImageIds: [IMG.c, IMG.d, IMG.f],
  artworkImageIds: [],
  genres: [facet(1, 'Roguelike'), facet(2, 'Action')],
  platforms: [facet(6, 'PC'), facet(130, 'Switch')],
  themes: [facet(17, 'Fantasy')],
  developers: [facet(7, 'Supergiant Games')],
  publishers: [facet(7, 'Supergiant Games')],
  gameModes: [facet(1, 'Single player')],
  rating: 92,
  ratingCount: 1500,
  franchiseId: 3,
  franchiseName: 'Hades',
  dlcs: [
    gameSummary(11, 'Hades II: Soundtrack', IMG.a),
    gameSummary(12, 'Hades II: Artbook', IMG.b),
  ],
  isAdult: false,
  steamAppIds: ['1145350'],
};

const mediaOf = () => {
  const type = CASE === 'game' ? 'game' : CASE === 'movie' ? 'movie' : 'tv_show';
  const title = CASE === 'game' ? 'Hades II' : CASE === 'movie' ? 'The Matrix' : 'Breaking Bad';
  return {
    id: 'm1',
    canonicalWorkId: 'c1',
    externalId: String(CASE === 'game' ? GAME.id : CASE === 'movie' ? MOVIE.id : TV.id),
    provider: type === 'game' ? 'igdb' : 'tmdb',
    mediaType: type,
    title,
    coverUrl: `https://image.tmdb.org/t/p/w342/${IMG.a}`,
    metadata: null,
    createdAt: '2026-01-01T00:00:00Z',
  };
};

const ITEM = {
  id: 'i1',
  userId: 'u1',
  media: mediaOf(),
  status: SHELF === 'planned' ? 'planned' : 'done',
  rating: SHELF === 'done' ? 8 : null,
  note: SHELF === 'done' ? { ops: [{ insert: 'Great.\n' }] } : null,
  containsSpoilers: false,
  progress: {},
  createdAt: '2026-08-12T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};
const lookup = () => (CASE === 'empty' || SHELF === 'none' ? null : ITEM);

const REVIEWS = ['Une claque visuelle, le rythme est parfait.', 'Culte, tout simplement.'].map(
  (text, i) => ({
    id: `r${i}`,
    userId: 'u2',
    username: ['margot', 'inès'][i],
    displayName: null,
    avatarUrl: null,
    media: mediaOf(),
    content: { ops: [{ insert: `${text}\n` }] },
    containsSpoilers: false,
    isLikedByViewer: false,
    likeCount: 3 + i,
    comments: [],
    commentCount: i,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  }),
);

const imageUrl = (path: string | null, size: string) =>
  path ? `https://image.tmdb.org/t/p/${size}${path.startsWith('/') ? path : '/' + path}` : null;

@Component({
  selector: 'shelfy-dev-media',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MediaDetailPageComponent],
  providers: [
    {
      provide: ActivatedRoute,
      useValue: {
        paramMap: of(
          convertToParamMap({
            mediaType:
              CASE === 'game' ? 'game' : CASE === 'movie' || CASE === 'empty' ? 'movie' : 'tv_show',
            externalId: String(
              CASE === 'game' ? GAME.id : CASE === 'movie' || CASE === 'empty' ? MOVIE.id : TV.id,
            ),
          }),
        ),
      },
    },
    { provide: AuthService, useValue: { currentUser: () => ({ id: 'u1' }) } },
    {
      provide: TmdbService,
      useValue: {
        getMovie: () =>
          of(
            CASE === 'empty'
              ? {
                  ...MOVIE,
                  overview: '',
                  backdropPath: null,
                  backdropImagePaths: [],
                  cast: [],
                  genres: [],
                  director: null,
                  productionCompanies: [],
                  budget: null,
                  revenue: null,
                }
              : MOVIE,
          ),
        getTvShow: () => of(TV),
        getTvSeason: () => of(SEASON),
        imageUrl,
      },
    },
    {
      provide: IgdbService,
      useValue: {
        getGame: () => of(GAME),
        imageUrl: (id: string | null) => (id ? `https://image.tmdb.org/t/p/w780/${id}` : null),
      },
    },
    {
      provide: RelatedMediaService,
      useValue: {
        getRelated: () =>
          of({
            sections: [
              {
                kind: 'similar',
                label: null,
                entity: null,
                items: [relatedGame(21, 'Hades', IMG.d), relatedGame(22, 'Bastion', IMG.f)],
                hasMore: true,
              },
              {
                kind: 'entity',
                label: null,
                entity: { kind: 'game-companies', id: '7', name: 'Supergiant Games', role: null },
                items: [relatedGame(23, 'Transistor', IMG.a), relatedGame(24, 'Pyre', IMG.b)],
                hasMore: false,
              },
            ],
          }).pipe(delay(RELATED_DELAY)),
      },
    },
    { provide: AniListService, useValue: {} },
    {
      provide: CollectionService,
      useValue: {
        lookup: () => of(lookup()),
        create: (request: object) => of({ ...ITEM, ...request }),
        update: (_id: string, request: object) => of({ ...ITEM, ...request }),
        remove: () => of(undefined),
        refreshItem: () => of(ITEM),
        changes: NEVER,
      },
    },
    {
      provide: UserProfileService,
      useValue: { getMediaReviews: () => of(CASE === 'empty' ? [] : REVIEWS) },
    },
    {
      provide: WatchLogService,
      useValue: {
        list: () =>
          of(
            SHELF === 'done'
              ? [
                  {
                    id: 'w1',
                    occurredAt: '2024-01-04',
                    isRewatch: false,
                    name: null,
                    rating: 8,
                    review: null,
                    containsSpoilers: false,
                    source: 'manual',
                    createdAt: '2024-01-04T00:00:00Z',
                  },
                  {
                    id: 'w2',
                    occurredAt: '2026-03-03',
                    isRewatch: true,
                    name: "Director's cut",
                    rating: 9,
                    review: null,
                    containsSpoilers: false,
                    source: 'manual',
                    createdAt: '2026-03-03T00:00:00Z',
                  },
                ]
              : [],
          ),
      },
    },
  ],
  template: '<shelfy-media-detail-page />',
})
export class DevMediaPageComponent {}
