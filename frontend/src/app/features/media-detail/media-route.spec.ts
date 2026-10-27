import type { Route, UrlSegment } from '@angular/router';
import { detailMediaRoute } from './media-route';

const matches = (url: string) =>
  detailMediaRoute(
    {} as Route,
    url.split('/').map((path) => ({ path }) as UrlSegment),
  );

describe('detailMediaRoute', () => {
  it('matches known media types with a valid id', () => {
    expect(matches('media/movie/603')).toBe(true);
    expect(matches('media/anime/21/episodes')).toBe(true);
  });

  it('rejects unknown types and non numeric ids where the provider needs one', () => {
    expect(matches('media/foo/1')).toBe(false);
    expect(matches('media/toString/1')).toBe(false);
    expect(matches('media/movie/abc')).toBe(false);
    expect(matches('media/game/0')).toBe(false);
  });
});
