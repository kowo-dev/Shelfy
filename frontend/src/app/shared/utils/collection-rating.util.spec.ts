import { formatRating, ratingToTextColor } from './collection-rating.util';

describe('collection rating bands', () => {
  it.each([
    [0, '--color-rating-low'],
    [4.9, '--color-rating-low'],
    [5, '--color-rating-mid'],
    [6, '--color-rating-mid'],
    [7, '--color-rating-good'],
    [8, '--color-rating-good'],
    [9, '--color-rating-high'],
    [10, '--color-rating-high'],
  ])('maps %s to %s', (rating, cssVar) => {
    expect(ratingToTextColor(rating)).toContain(`var(${cssVar})`);
  });
});

describe('formatRating', () => {
  it.each([
    [1, '0.5'],
    [2, '1'],
    [7, '3.5'],
    [8, '4'],
    [10, '5'],
    [8.5, '4.3'],
    [9, '4.5'],
    [7.2, '3.6'],
    [9.9, '5'],
  ])('shows %s out of ten as %s out of five', (rating, shown) => {
    expect(formatRating(rating)).toBe(shown);
  });
});
