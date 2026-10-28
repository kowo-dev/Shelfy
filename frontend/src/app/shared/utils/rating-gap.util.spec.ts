import { formatGap, ratingGap } from './rating-gap.util';

describe('ratingGap', () => {
  it('needs a rating on both sides', () => {
    expect(ratingGap(null, 8)).toBeNull();
    expect(ratingGap(8, null)).toBeNull();
  });

  it('names the gap from my side', () => {
    expect(ratingGap(8, 8)).toEqual({ kind: 'same', delta: 0 });
    expect(ratingGap(8, 7)).toEqual({ kind: 'close', delta: -1 });
    expect(ratingGap(6, 9)).toEqual({ kind: 'more', delta: 3 });
    expect(ratingGap(9, 7)).toEqual({ kind: 'less', delta: -2 });
    expect(ratingGap(10, 6)).toEqual({ kind: 'far', delta: -4 });
  });

  it('formats the gap in signed stars', () => {
    expect(formatGap(3)).toBe('+1.5');
    expect(formatGap(-4)).toBe('−2');
  });
});
