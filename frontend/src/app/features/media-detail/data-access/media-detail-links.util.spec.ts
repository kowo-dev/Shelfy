import {
  browseQueryParams,
  browseUrl,
  characterUrl,
  companyUrl,
  franchiseUrl,
  gameCompanyUrl,
  networkUrl,
  personUrl,
  staffUrl,
  steamStoreUrl,
  studioUrl,
} from './media-detail-links.util';

describe('media-detail-links.util', () => {
  it('personUrl builds a people route', () => {
    expect(personUrl(42)).toBe('/people/42');
  });

  it('characterUrl builds a characters route', () => {
    expect(characterUrl('abc')).toBe('/characters/abc');
  });

  it('staffUrl builds a staff route', () => {
    expect(staffUrl(7)).toBe('/staff/7');
  });

  it('companyUrl builds a companies route', () => {
    expect(companyUrl(10)).toBe('/companies/10');
  });

  it('networkUrl builds a networks route', () => {
    expect(networkUrl(213)).toBe('/networks/213');
  });

  it('studioUrl builds a studios route', () => {
    expect(studioUrl(20)).toBe('/studios/20');
  });

  it('gameCompanyUrl builds a game-companies route', () => {
    expect(gameCompanyUrl(30)).toBe('/game-companies/30');
  });

  it('franchiseUrl builds a franchises route', () => {
    expect(franchiseUrl(99)).toBe('/franchises/99');
  });

  it('browseUrl builds a browse route from media type, facet and value', () => {
    expect(browseUrl('game', 'platform', 'PC')).toBe('/browse/game/platform/PC');
  });

  it('browseQueryParams wraps a name in a query params object', () => {
    expect(browseQueryParams('Action')).toEqual({ name: 'Action' });
  });

  it('steamStoreUrl builds and encodes a steam store link', () => {
    expect(steamStoreUrl('123 456')).toBe('https://store.steampowered.com/app/123%20456');
  });
});
