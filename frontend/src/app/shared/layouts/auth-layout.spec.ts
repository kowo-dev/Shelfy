import { posterColumns } from './auth-layout';

describe('posterColumns', () => {
  it('interleaves the sources and fills every column', () => {
    expect(posterColumns([['m1', 'm2'], ['s1'], ['g1', 'g2']], 2, 3)).toEqual([
      ['m1', 's1', 'g1'],
      ['m2', 'g2', 'm1'],
    ]);
  });

  it('returns no column when every source is empty', () => {
    expect(posterColumns([[], []], 5, 8)).toEqual([]);
  });
});
