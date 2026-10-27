import { convertToParamMap } from '@angular/router';

import {
  EMPTY_EXPLORE_QUERY,
  exploreApiParams,
  fromRouteParams,
  toRouteParams,
  type ExploreQuery,
} from './explore-query';

describe('explore query', () => {
  const query: ExploreQuery = {
    text: ' dune ',
    type: 'movie',
    with: [
      { token: 'science-fiction', label: null },
      { token: 'streaming:8', label: 'Netflix' },
    ],
    without: [{ token: 'horror', label: null }],
    from: 2010,
    to: 2019,
    sort: 'rating',
  };

  it('round-trips through the URL, keeping the labels of catalog criteria', () => {
    const params = toRouteParams(query);

    expect(params['with']).toEqual(['science-fiction', 'streaming:8~Netflix']);
    expect(fromRouteParams(convertToParamMap(params))).toEqual({ ...query, text: 'dune' });
  });

  it('leaves defaults out of the URL', () => {
    expect(toRouteParams(EMPTY_EXPLORE_QUERY)).toEqual({
      q: null,
      type: null,
      with: null,
      without: null,
      from: null,
      to: null,
      sort: null,
    });
  });

  it('sends tokens without their display labels to the API', () => {
    expect(exploreApiParams(query)).toEqual([
      ['sort', 'rating'],
      ['query', 'dune'],
      ['type', 'movie'],
      ['with', 'science-fiction'],
      ['with', 'streaming:8'],
      ['without', 'horror'],
      ['from', '2010'],
      ['to', '2019'],
    ]);
  });

  it('ignores invalid values and swaps inverted years', () => {
    const parsed = fromRouteParams(
      convertToParamMap({
        type: 'book',
        sort: 'random',
        from: '2020',
        to: '1990',
        with: ['horror', 'horror', ''],
      }),
    );

    expect(parsed.type).toBeNull();
    expect(parsed.sort).toBe('popular');
    expect([parsed.from, parsed.to]).toEqual([1990, 2020]);
    expect(parsed.with).toEqual([{ token: 'horror', label: null }]);
  });
});
