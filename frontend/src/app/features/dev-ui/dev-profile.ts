import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { AuthService } from '@app/core/services/auth/auth';
import { CollectionService } from '@app/core/services/collection/collection';
import { FollowsService } from '@app/core/services/follows/follows';
import { PeopleService } from '@app/core/services/people/people';
import { ListsService } from '@app/core/services/lists/lists';
import { UserProfileService } from '@app/core/services/users/user-profile';
import { ProfilePageComponent } from '../profile/profile';

const TMDB = 'https://image.tmdb.org/t/p/w342/';
const BACK = 'https://image.tmdb.org/t/p/w1280/';

function media(
  id: string,
  title: string,
  mediaType: string,
  coverUrl: string,
  metadata: Record<string, unknown> | null = null,
) {
  return {
    id,
    canonicalWorkId: id,
    externalId: id,
    provider: 'tmdb',
    mediaType,
    title,
    coverUrl,
    metadata,
    createdAt: '2026-06-01T00:00:00Z',
  };
}

export function item(m: ReturnType<typeof media>, status: string, rating: number | null) {
  return {
    id: `i-${m.id}`,
    userId: 'u1',
    media: m,
    status,
    rating,
    note: null,
    containsSpoilers: false,
    progress: {},
    createdAt: '2026-08-12T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };
}

const OVERVIEW =
  'Sasaki is an overworked salaryman drifting through the corporate grind, sustained by cigarettes and the cheerful smile of Yamada, the clerk at his favorite supermarket.<br><br><i>Note: Episodes 1-6 had an early release.</i>';

export const M = {
  bg3: media('1', "Baldur's Gate 3", 'game', `${TMDB}5Xc7WpWsgflfgEMoBlf9TmWhfbH.jpg`),
  sponge: media('2', 'SpongeBob SquarePants', 'tv_show', `${TMDB}5h0EU2lqBb03dp5vtRuUHJwqzem.jpg`, {
    backdropUrl: `${BACK}9faGSFi5jam6pDWGNd0p8JcJgXQ.jpg`,
    releaseDate: '1999-05-01',
    overview: OVERVIEW,
  }),
  current: media('3', 'Against the Current', 'tv_show', `${TMDB}euBlF64efQmsl2y54LeNmLQPNob.jpg`),
  eden: media('4', 'East of Eden', 'movie', `${TMDB}axdUor6gLMTrrB1UF4Qfy0TTSyX.jpg`, {
    backdropUrl: `${BACK}9faGSFi5jam6pDWGNd0p8JcJgXQ.jpg`,
  }),
  a: media('5', 'Soulm8te', 'movie', `${TMDB}oC2MuEWxnLVTyYw70XoK2HFf7nW.jpg`),
  b: media('6', 'Red Queen', 'tv_show', `${TMDB}uRHsiw1wLxPHFXkkv4Ix1s0O6f4.jpg`),
  c: media('7', 'Twisted Love', 'webtoon', `${TMDB}5Xc7WpWsgflfgEMoBlf9TmWhfbH.jpg`),
  d: media('8', 'ONE PIECE', 'anime', `${TMDB}5h0EU2lqBb03dp5vtRuUHJwqzem.jpg`),
};

const PROFILE = {
  id: 'u1',
  username: 'Kowo',
  displayName: 'Kowo',
  bio: 'Movie person. Collecting, rating and arguing about endings.',
  avatarUrl: null,
  profileBannerUrl: null,
  profileBannerTitle: null,
  profileBannerProvider: null,
  profileBannerSourceUrl: null,
  profileBannerPosition: null,
  profileVisibility: 'public',
  isFollowedByCurrentUser: false,
  createdAt: '2026-01-04T00:00:00Z',
  stats: { totalItems: 312, averageRating: 7.8, followersCount: 41, reviewsCount: 8 },
  ongoingItems: [
    item(M.sponge, 'ongoing', 8),
    item(M.a, 'ongoing', null),
    item(M.b, 'ongoing', null),
    item(M.c, 'ongoing', null),
    item(M.d, 'ongoing', null),
  ],
};

const REVIEW = (id: string, m: ReturnType<typeof media>, text: string) => ({
  id,
  userId: 'u1',
  username: 'Kowo',
  displayName: 'Kowo',
  avatarUrl: null,
  media: m,
  content: { ops: [{ insert: `${text}\n` }] },
  containsSpoilers: false,
  isLikedByViewer: false,
  likeCount: 1,
  comments: [],
  commentCount: 0,
  createdAt: '2026-10-12T00:00:00Z',
  updatedAt: '2026-10-12T00:00:00Z',
});

const LIST = {
  id: 'l1',
  userId: 'u1',
  name: 'Mes indispensables',
  description: null,
  visibility: 'public',
  tags: [],
  media: [M.a, M.b, M.eden, M.current],
  isLikedByViewer: false,
  likeCount: 5,
  completion: { total: 4, done: 2 },
  comments: [],
  commentCount: 3,
  collaborators: [],
  pendingInvites: [],
  canEditItems: true,
  viewerCollaboratorStatus: null,
  creatorUsername: 'Kowo',
  creatorAvatarUrl: null,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

const ACTIVITY = [
  {
    id: 'a1',
    type: 'COMMENTED',
    media: null,
    payload: { listName: 'Mes indispensables' },
    createdAt: '2026-10-12T10:00:00Z',
  },
  {
    id: 'a2',
    type: 'REVIEWED',
    media: M.sponge,
    payload: { action: 'added' },
    createdAt: '2026-10-12T09:00:00Z',
  },
  {
    id: 'a3',
    type: 'RATED',
    media: M.a,
    payload: { rating: 9 },
    createdAt: '2026-10-11T09:00:00Z',
  },
  {
    id: 'a4',
    type: 'STATUS_CHANGED',
    media: M.b,
    payload: { status: 'ongoing' },
    createdAt: '2026-10-10T09:00:00Z',
  },
  {
    id: 'a5',
    type: 'REVIEWED',
    media: M.eden,
    payload: { action: 'added' },
    createdAt: '2026-10-09T09:00:00Z',
  },
];

export const essentialEntry = (slot: number, m: ReturnType<typeof media>) => ({
  slot,
  userMediaId: `i-${m.id}`,
  media: m,
});

export const DEV_ESSENTIALS = [M.eden, M.bg3, M.sponge, M.d, M.b].map((m, slot) =>
  essentialEntry(slot, m),
);

const PEOPLE = [
  ['Camille Rousseau', 'camille_rousseau'],
  ['Hugo Lambert', 'hugo_lambert'],
  ['Léa Moreau', 'lea_moreau'],
  ['Thomas Petit', 'thomas_petit'],
  ['Sarah Dubois', 'sarah_dubois'],
  ['Nathan Giraud', 'nathan_giraud'],
].map(([displayName, username], index) => ({ id: `p${index}`, username, displayName }));
const page = <T>(content: T[]) => of({ content, totalElements: content.length });

export const CASE = new URLSearchParams(globalThis.location?.search ?? '').get('case');
const few = <T>(items: T[]): T[] =>
  CASE === 'empty' ? [] : CASE === 'one' ? items.slice(0, 1) : items;

export const DEV_PROFILE_PROVIDERS = [
  {
    provide: ActivatedRoute,
    useValue: {
      paramMap: of(convertToParamMap({ username: 'Kowo' })),
      queryParamMap: of(
        convertToParamMap(
          Object.fromEntries(new URLSearchParams(globalThis.location?.search ?? '')),
        ),
      ),
      snapshot: {
        queryParamMap: convertToParamMap(
          Object.fromEntries(new URLSearchParams(globalThis.location?.search ?? '')),
        ),
      },
    },
  },
  {
    provide: AuthService,
    useValue: {
      currentUser: () => (CASE === 'visitor' ? { id: 'me', username: 'me' } : { id: 'u1' }),
    },
  },
  {
    provide: UserProfileService,
    useValue: {
      getProfile: () =>
        of({
          ...PROFILE,
          ongoingItems: few(PROFILE.ongoingItems),
          bio: CASE === 'empty' ? null : PROFILE.bio,
        }),
      getEssentials: () => of(CASE === 'empty' ? [] : DEV_ESSENTIALS),
      getActivity: () => of({ content: few(ACTIVITY), totalElements: 5 }),
      getReviews: () =>
        of({
          content: few([
            REVIEW(
              'r1',
              M.sponge,
              'Excellent casting, écriture inégale. Je recommande quand même.',
            ),
            REVIEW(
              'r2',
              M.a,
              'Sympa sans plus : bonne idée de départ, exécution trop sage. Le deuxième acte traîne en longueur, les personnages secondaires sont sacrifiés et la mise en scène ne prend jamais de risque. Pourtant la photographie est superbe, la musique porte chaque scène et le final rattrape presque tout. À voir pour les acteurs, à oublier pour le scénario qui tourne en rond pendant une heure entière.',
            ),
            REVIEW(
              'r3',
              M.b,
              'Une claque. Chaque épisode monte d’un cran et la fin tient ses promesses sans trahir le reste.',
            ),
            REVIEW(
              'r4',
              M.eden,
              'Je ne m’attendais à rien et c’est devenu un de mes préférés de l’année.',
            ),
          ]),
          totalElements: 8,
        }),
    },
  },
  {
    provide: ListsService,
    useValue: { forProfile: () => of({ content: few([LIST]), totalElements: 1 }) },
  },
  {
    provide: FollowsService,
    useValue: {
      followers: () => page(PEOPLE),
      following: () => page([PEOPLE[1], PEOPLE[4], PEOPLE[5], PEOPLE[2], PEOPLE[3]]),
      followersOf: () => page(PEOPLE),
      popular: () =>
        page(
          (
            [
              ['Maëlle Fontaine', 'maelle_fontaine', 1284],
              ['Jules Bernard', 'julesb', 932],
              ['Inès Laurent', 'ines.reads', 611],
              ['Victor Chen', 'victorchen', 402],
              ['Zoé Marchand', 'zoe_plays', 287],
            ] as const
          ).map(([displayName, username, followersCount], i) => ({
            id: `pop${i}`,
            username,
            displayName,
            avatarUrl: null,
            followersCount,
          })),
        ),
      followingOf: () => page(PEOPLE.slice(0, 3)),
      follow: () => of(undefined),
      unfollow: () => of(undefined),
    },
  },
  {
    provide: PeopleService,
    useValue: { search: () => page([]) },
  },
  {
    provide: CollectionService,
    useValue: {
      changes: EMPTY,
      list: () => {
        const content = Object.values(M).map((m, index) => item(m, 'done', 10 - index));
        return of({ content, page: 0, size: 48, totalElements: content.length });
      },
      statsForUser: () =>
        of({
          total: CASE === 'empty' ? 0 : 312,
          averageRating: CASE === 'empty' ? null : 7.8,
          countsByStatus:
            CASE === 'empty' ? {} : { planned: 96, ongoing: 14, done: 181, dropped: 21 },
          countsByMediaType:
            CASE === 'empty' ? {} : { movie: 142, tv_show: 61, game: 48, anime: 33, manga: 28 },
        }),
    },
  },
];

@Component({
  selector: 'shelfy-dev-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProfilePageComponent],
  providers: DEV_PROFILE_PROVIDERS,
  template: '<shelfy-profile-page />',
})
export class DevProfilePageComponent {}
