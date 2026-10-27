import { CREATIONS, PEOPLE, isPathActive, ownsUrl } from './nav-sections';

describe('isPathActive', () => {
  it('matches the path itself and its children', () => {
    expect(isPathActive('/lists', '/lists')).toBe(true);
    expect(isPathActive('/lists/abc', '/lists')).toBe(true);
    expect(isPathActive('/discover?type=movie&feed=new', '/discover')).toBe(true);
  });

  it('does not match a sibling that only shares a prefix', () => {
    expect(isPathActive('/listsy', '/lists')).toBe(false);
    expect(isPathActive('/collection-history', '/collection')).toBe(false);
  });
});

describe('ownsUrl', () => {
  it('keeps Creations highlighted on its own detail pages', () => {
    expect(ownsUrl('/creations?f=lists', CREATIONS)).toBe(true);
    expect(ownsUrl('/lists/abc', CREATIONS)).toBe(true);
    expect(ownsUrl('/versus/abc', CREATIONS)).toBe(true);
    expect(ownsUrl('/reviews/abc', CREATIONS)).toBe(true);
  });

  it("puts someone's profile and shelf under People, not my own profile", () => {
    expect(ownsUrl('/people?tab=followers', PEOPLE)).toBe(true);
    expect(ownsUrl('/profile/hugo', PEOPLE)).toBe(true);
    expect(ownsUrl('/users/hugo?compare=1', PEOPLE)).toBe(true);
    expect(ownsUrl('/users/hugo', CREATIONS)).toBe(false);
    expect(ownsUrl('/profile', PEOPLE)).toBe(false);
  });

  it('leaves the old paths to their redirects', () => {
    expect(ownsUrl('/friends', PEOPLE)).toBe(false);
    expect(ownsUrl('/community', CREATIONS)).toBe(false);
  });
});
