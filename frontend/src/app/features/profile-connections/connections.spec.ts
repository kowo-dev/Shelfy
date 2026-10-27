import { firstValueFrom, of } from 'rxjs';
import {
  fromPopularUser,
  fromUser,
  people,
  toConnectionView,
  type Connection,
  type ViewContext,
} from './connections';

const person = (overrides: Partial<Connection> = {}): Connection => ({
  key: 'k1',
  userId: 'u1',
  username: 'alice',
  name: 'Alice',
  avatarUrl: null,
  favorite: false,
  bannerUrl: null,
  titleCount: null,
  coverUrls: [],
  ...overrides,
});

const context = (overrides: Partial<ViewContext> = {}): ViewContext => ({
  tab: 'followers',
  owner: true,
  me: 'me',
  following: new Set(),
  followers: new Set(),
  ...overrides,
});

describe('toConnectionView', () => {
  describe('on someone else page', () => {
    const visitor = (overrides: Partial<ViewContext> = {}) =>
      context({ owner: false, ...overrides });

    it('offers to follow a stranger', () => {
      expect(toConnectionView(person(), visitor()).action?.kind).toBe('follow');
    });

    it('notes people already followed instead of offering to follow', () => {
      const view = toConnectionView(person(), visitor({ following: new Set(['u1']) }));

      expect(view).toMatchObject({ action: null, noteKey: 'community.people.you_follow' });
    });

    it('offers nothing for yourself or when signed out', () => {
      expect(toConnectionView(person({ userId: 'me' }), visitor()).action).toBeNull();
      expect(toConnectionView(person(), visitor({ me: undefined })).action).toBeNull();
    });
  });

  describe('on my own page', () => {
    it('offers to follow a follower back, or notes that it is mutual', () => {
      expect(toConnectionView(person(), context()).action?.labelKey).toBe(
        'community.people.follow_back',
      );
      expect(toConnectionView(person(), context({ following: new Set(['u1']) })).noteKey).toBe(
        'community.people.mutual',
      );
    });

    it('lets me unfollow and notes who follows me', () => {
      const view = toConnectionView(
        person(),
        context({ tab: 'following', followers: new Set(['u1']) }),
      );

      expect(view.action?.kind).toBe('unfollow');
      expect(view.noteKey).toBe('community.people.follows_you');
    });

    it('offers to follow a suggestion', () => {
      const view = toConnectionView(person(), context({ tab: 'discover' }));

      expect(view).toMatchObject({ action: { kind: 'follow' }, noteKey: null });
    });
  });
});

describe('mappers', () => {
  const user = {
    id: 'u1',
    username: 'alice',
    displayName: null,
    avatarUrl: undefined as never,
    bannerUrl: null,
    titleCount: null,
    coverUrls: [],
  };

  it('shows the display name, falling back to the username', () => {
    expect(fromUser(user).name).toBe('alice');
    expect(fromUser({ ...user, displayName: 'Alice A.' }).name).toBe('Alice A.');
    expect(fromUser(user).avatarUrl).toBeNull();
  });

  it('carries the banner, the title count and the covers of the person', () => {
    const card = { bannerUrl: 'b.jpg', titleCount: 12, coverUrls: ['1.jpg', '2.jpg'] };

    expect(fromUser({ ...user, ...card })).toMatchObject(card);
  });

  it('keeps the follower count of a suggestion', () => {
    expect(fromPopularUser({ ...user, followersCount: 7 })).toMatchObject({
      key: 'u1',
      followersCount: 7,
    });
  });

  it('maps a whole page of results', async () => {
    const page = await firstValueFrom(people(of({ content: [user], totalElements: 9 }), fromUser));

    expect(page.totalElements).toBe(9);
    expect(page.content[0].username).toBe('alice');
  });
});
