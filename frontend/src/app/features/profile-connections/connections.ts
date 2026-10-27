import { map, type Observable } from 'rxjs';
import type { PopularUserResponse } from '@app/core/services/follows/follows';
import type { PersonCardFields } from '@app/core/services/people/people.model';

export type ConnectionsTab = 'activity' | 'favorites' | 'following' | 'followers' | 'discover';

export interface Connection extends PersonCardFields {
  key: string;
  userId: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  favorite: boolean;
}

export interface ConnectionsPage {
  people: Connection[];
  total: number;
  loading: boolean;
  loaded: boolean;
}

export interface ConnectionAction {
  labelKey: string;
  primary: boolean;
  kind: 'follow' | 'unfollow';
}

export interface ConnectionView extends Connection {
  noteKey: string | null;
  action: ConnectionAction | null;
}

export interface PagedPeople {
  content: Connection[];
  totalElements: number;
}

export const PAGE = 30;
export const OWNER_TABS: ConnectionsTab[] = [
  'activity',
  'following',
  'followers',
  'favorites',
  'discover',
];
export const VISITOR_TABS: ConnectionsTab[] = ['followers', 'following'];
export const TAB_LABEL: Record<ConnectionsTab, string> = {
  activity: 'feed.tab',
  favorites: 'connections.favorites',
  following: 'friends.tabs.following',
  followers: 'friends.tabs.followers',
  discover: 'connections.suggestions',
};
export interface EmptyCopy {
  title: string;
  mine: string;
  theirs: string;
}
export const EMPTY_COPY: Record<ConnectionsTab, EmptyCopy> = {
  activity: {
    title: 'feed.empty_title',
    mine: 'feed.empty_body',
    theirs: 'feed.empty_body',
  },
  favorites: {
    title: 'connections.empty.favorites_title',
    mine: 'connections.empty.favorites_mine',
    theirs: 'connections.empty.favorites_mine',
  },
  following: {
    title: 'connections.empty.following_title',
    mine: 'friends.following.empty',
    theirs: 'connections.empty.following_theirs',
  },
  followers: {
    title: 'connections.empty.followers_title',
    mine: 'friends.followers.empty',
    theirs: 'connections.empty.followers_theirs',
  },
  discover: {
    title: 'connections.empty.suggestions_title',
    mine: 'community.people.discover_empty',
    theirs: 'community.people.discover_empty',
  },
};

export const emptyPage = (): ConnectionsPage => ({
  people: [],
  total: 0,
  loading: false,
  loaded: false,
});

export function people<T>(
  source: Observable<{ content: T[]; totalElements: number }>,
  toConnection: (item: T) => Connection,
): Observable<PagedPeople> {
  return source.pipe(
    map((response) => ({
      content: response.content.map(toConnection),
      totalElements: response.totalElements,
    })),
  );
}

export function cardFields(source: PersonCardFields): PersonCardFields {
  return {
    bannerUrl: source.bannerUrl,
    titleCount: source.titleCount,
    coverUrls: source.coverUrls,
    followersCount: source.followersCount ?? null,
  };
}

export function fromUser(
  user: PersonCardFields & {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    isFavorite?: boolean;
  },
): Connection {
  return {
    key: user.id,
    userId: user.id,
    username: user.username,
    name: user.displayName || user.username,
    avatarUrl: user.avatarUrl ?? null,
    favorite: user.isFavorite ?? false,
    ...cardFields(user),
  };
}

export function fromPopularUser(user: PopularUserResponse): Connection {
  return fromUser(user);
}

export interface ViewContext {
  tab: ConnectionsTab;
  owner: boolean;
  me: string | undefined;
  following: ReadonlySet<string>;
  followers: ReadonlySet<string>;
}

export const FOLLOW: ConnectionAction = {
  labelKey: 'profile.follow.action',
  primary: true,
  kind: 'follow',
};

export function toConnectionView(person: Connection, ctx: ViewContext): ConnectionView {
  const view = (
    action: ConnectionAction | null,
    noteKey: string | null = null,
  ): ConnectionView => ({
    ...person,
    action,
    noteKey,
  });
  const { following, followers } = ctx;
  if (!ctx.owner) {
    if (!ctx.me || person.userId === ctx.me) return view(null);
    return following.has(person.userId) ? view(null, 'community.people.you_follow') : view(FOLLOW);
  }
  switch (ctx.tab) {
    case 'followers':
      return following.has(person.userId)
        ? view(null, 'community.people.mutual')
        : view({ ...FOLLOW, labelKey: 'community.people.follow_back' });
    case 'favorites':
    case 'following':
      return view(
        { labelKey: 'community.people.unfollow', primary: false, kind: 'unfollow' },
        followers.has(person.userId) ? 'community.people.follows_you' : null,
      );
    case 'activity':
    case 'discover':
      return view(FOLLOW);
  }
}
