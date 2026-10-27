import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EMPTY, of } from 'rxjs';
import type {
  CollectionItemResponse,
  MediaResponse,
  UserMediaStatus,
} from '@app/core/services/collection/collection.model';
import { AniListService } from '@app/core/services/anilist/anilist';
import { DiscoverService } from '@app/core/services/discover/discover';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { ShelfLookupService } from '@app/core/services/shelf-lookup/shelf-lookup';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { DiscoverPageComponent } from '../discover/discover';

const TMDB = 'https://image.tmdb.org/t/p/w342/';
const BACK = 'https://image.tmdb.org/t/p/w1280/';
const COVERS = [
  `${TMDB}5Xc7WpWsgflfgEMoBlf9TmWhfbH.jpg`,
  `${TMDB}5h0EU2lqBb03dp5vtRuUHJwqzem.jpg`,
  `${TMDB}euBlF64efQmsl2y54LeNmLQPNob.jpg`,
  `${TMDB}axdUor6gLMTrrB1UF4Qfy0TTSyX.jpg`,
  `${TMDB}oC2MuEWxnLVTyYw70XoK2HFf7nW.jpg`,
  `${TMDB}uRHsiw1wLxPHFXkkv4Ix1s0O6f4.jpg`,
];
const BANNER = `${BACK}9faGSFi5jam6pDWGNd0p8JcJgXQ.jpg`;
const MISSING = `${TMDB}0000000000000000000000000000.jpg`;

export const CASES = ['demo', 'worst', 'empty', 'one'] as const;
type Case = (typeof CASES)[number];

const params = new URLSearchParams(globalThis.location?.search ?? '');
const requested = params.get('case');
export const CASE: Case = CASES.includes(requested as Case) ? (requested as Case) : 'demo';

interface Entry {
  id: number;
  title: string;
  cover: string | null;
  banner?: string;
  rating: number;
  year: string | null;
  genres?: string[];
  owned?: [UserMediaStatus, number | null];
}

const DEMO: Entry[] = [
  {
    id: 1,
    title: 'Frieren',
    cover: COVERS[0],
    banner: BANNER,
    rating: 91,
    year: '2023-09-29',
    genres: ['Adventure', 'Drama', 'Fantasy'],
  },
  {
    id: 2,
    title: 'Dandadan',
    cover: COVERS[1],
    rating: 84,
    year: '2024-10-04',
    owned: ['ongoing', 8],
  },
  { id: 3, title: 'Blue Lock', cover: COVERS[2], rating: 78, year: '2022-10-09' },
  { id: 4, title: 'Kaiju No. 8', cover: COVERS[3], rating: 80, year: '2024-04-13' },
  {
    id: 5,
    title: 'Oshi no Ko',
    cover: COVERS[4],
    rating: 86,
    year: '2023-04-12',
    owned: ['done', 9],
  },
  { id: 6, title: 'Spy x Family', cover: COVERS[5], rating: 82, year: '2022-04-09' },
  { id: 7, title: 'Mashle', cover: COVERS[0], rating: 76, year: '2023-04-08' },
  { id: 8, title: 'Bocchi the Rock!', cover: COVERS[1], rating: 88, year: '2022-10-09' },
];

const WORST: Entry[] = [
  {
    id: 101,
    title: 'I Got a Cheat Skill in Another World and Became Unrivaled in The Real World, Too',
    cover: COVERS[0],
    banner: BANNER,
    rating: 100,
    year: null,
    genres: ['Slice of Life', 'Supernatural', 'Mahou Shoujo', 'Action', 'Romance'],
    owned: ['ongoing', 10],
  },
  {
    id: 102,
    title: '【推しの子】',
    cover: COVERS[1],
    rating: 87,
    year: '2023-04-12',
    owned: ['dropped', null],
  },
  { id: 103, title: 'K', cover: COVERS[2], rating: 0, year: '2012-10-05' },
  {
    id: 104,
    title: 'Ōkami to Kōshinryō: Merchant Meets the Wise Wolf',
    cover: null,
    rating: 79,
    year: '2024-04-02',
  },
  {
    id: 105,
    title: 'Kaguya-sama: Love is War -The First Kiss That Never Ends-',
    cover: MISSING,
    rating: 89,
    year: '2022-12-17',
    owned: ['done', 1],
  },
  {
    id: 106,
    title: '鬼滅の刃 柱稽古編',
    cover: BANNER,
    rating: 83,
    year: '2024-05-12',
    owned: ['planned', null],
  },
  {
    id: 107,
    title: 'Uzaki-chan Wants to Hang Out! ω',
    cover: COVERS[3],
    rating: 66,
    year: '2022-10-01',
    owned: ['done', 6],
  },
  {
    id: 108,
    title: 'Shingeki no Kyojin: The Final Season - Kanketsu-hen (Zenpen)',
    cover: COVERS[4],
    rating: 91,
    year: '2023-03-04',
  },
  { id: 109, title: 'Jo', cover: COVERS[5], rating: 61, year: '2027-01-08' },
  {
    id: 110,
    title: 'Mobile Suit Gundam: The Witch from Mercury Season 2',
    cover: COVERS[0],
    rating: 78,
    year: '2023-04-09',
  },
  {
    id: 111,
    title: 'Đặng Thị Ngọc Hân và những người bạn',
    cover: COVERS[1],
    rating: 55,
    year: '2021-01-01',
  },
  {
    id: 112,
    title: 'Benachrichtigungseinstellungsassistent',
    cover: COVERS[2],
    rating: 70,
    year: '2020-07-01',
  },
];

const ENTRIES: Entry[] =
  CASE === 'worst' ? WORST : CASE === 'empty' ? [] : CASE === 'one' ? DEMO.slice(0, 1) : DEMO;

const anime = (entry: Entry) => ({
  id: entry.id,
  title: entry.title,
  summary: '',
  releaseDate: entry.year,
  coverImageUrl: entry.cover,
  bannerImageUrl: entry.banner ?? null,
  genres: entry.genres ?? ['Comedy'],
  rating: entry.rating,
  popularity: 1284,
  episodes: 12,
  chapters: 120,
  status: 'RELEASING',
});

const paged = <T>(content: T[]) => of({ content, totalElements: content.length });
const feed = () => paged(ENTRIES.map(anime));

function mediaKey(media: Pick<MediaResponse, 'mediaType' | 'externalId'>): string {
  return `${media.mediaType}:${media.externalId}`;
}

const OWNED = new Map<string, CollectionItemResponse>(
  ENTRIES.filter((entry) => entry.owned).flatMap((entry) =>
    (['anime', 'manga'] as const).map((mediaType) => {
      const [status, rating] = entry.owned!;
      const id = String(entry.id);
      const media: MediaResponse = {
        id: `anilist:${mediaType}:${id}`,
        canonicalWorkId: id,
        externalId: id,
        provider: 'anilist',
        mediaType,
        title: entry.title,
        coverUrl: entry.cover,
        metadata: { releaseDate: entry.year },
        createdAt: '',
      };
      return [
        mediaKey(media),
        {
          id: `owned-${mediaType}-${id}`,
          userId: 'me',
          media,
          status,
          rating,
          note: null,
          containsSpoilers: false,
          progress: {},
          createdAt: '2026-08-12T00:00:00Z',
          updatedAt: '2026-10-01T00:00:00Z',
        },
      ] as const;
    }),
  ),
);

const DEV_DISCOVER_PROVIDERS = [
  {
    provide: DiscoverService,
    useValue: {
      getAnime: feed,
      getManga: feed,
      getMovies: () => paged([]),
      getSeries: () => paged([]),
      getGames: () => paged([]),
      getWebtoons: feed,
    },
  },
  {
    provide: AniListService,
    useValue: {
      getAnime: () => of({ trailerUrl: 'https://example.com/trailer' }),
      getManga: () => of({ trailerUrl: null }),
      browseByGenre: () =>
        of({
          items: ENTRIES.map((entry) => ({
            id: entry.id,
            title: entry.title,
            coverImageUrl: entry.cover,
            rating: entry.rating,
          })),
        }),
    },
  },
  {
    provide: TmdbService,
    useValue: {
      imageUrl: (path: string | null) => path,
      getMoviesByGenre: () => of({ results: [] }),
      getTvShowsByGenre: () => of({ results: [] }),
    },
  },
  {
    provide: IgdbService,
    useValue: { imageUrl: () => null, getGamesByGenre: () => paged([]) },
  },
  {
    provide: ShelfLookupService,
    useValue: {
      find: (media: MediaResponse) => OWNED.get(mediaKey(media)) ?? null,
      request: () => EMPTY,
    },
  },
];

@Component({
  selector: 'shelfy-dev-discover',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DiscoverPageComponent],
  providers: DEV_DISCOVER_PROVIDERS,
  host: { class: 'contents' },
  template: `
    <shelfy-discover-page />
    <nav
      class="bg-surface-raised fixed bottom-28 left-1/2 z-50 flex -translate-x-1/2 gap-1 rounded-full p-1 font-sans text-sm shadow-lg md:bottom-6"
      aria-label="Dev data"
    >
      @for (option of cases; track option) {
        <a
          [href]="'?case=' + option + '&type=anime'"
          class="rounded-full px-3 py-1.5"
          [class]="option === active ? 'bg-text text-background' : 'text-text-muted'"
          >{{ option }}</a
        >
      }
    </nav>
  `,
})
export class DevDiscoverPageComponent {
  protected readonly cases = CASES;
  protected readonly active = CASE;
}
