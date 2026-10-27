const RATING_BANDS: [ceiling: number, cssVar: string][] = [
  [5, '--color-rating-low'],
  [7, '--color-rating-mid'],
  [9, '--color-rating-good'],
  [Infinity, '--color-rating-high'],
];

export function normalizeExternalRating(provider: string, rating: number): number {
  return ['igdb', 'anilist'].includes(provider.toLowerCase()) && rating > 10 ? rating / 10 : rating;
}

export function formatRating(value: number): string {
  return (value / 2).toFixed(1).replace(/\.0$/, '');
}

export const EXTERNAL_RATING_COLOR = 'var(--color-text-muted)';

export function ratingVerdictKey(rating: number | null): string {
  if (rating === null) return 'collection.verdict.none';
  if (rating >= 10) return 'collection.verdict.masterpiece';
  if (rating >= 9) return 'collection.verdict.amazing';
  if (rating >= 8) return 'collection.verdict.great';
  if (rating >= 7) return 'collection.verdict.good';
  if (rating >= 5) return 'collection.verdict.okay';
  if (rating >= 3) return 'collection.verdict.weak';
  return 'collection.verdict.bad';
}

export function ratingColor(rating: number): string {
  return ratingColorVar(rating);
}

function ratingColorVar(rating: number): string {
  const [, cssVar] = RATING_BANDS.find(([ceiling]) => rating < ceiling) ?? RATING_BANDS.at(-1)!;
  return `var(${cssVar})`;
}

export function ratingToTextColor(rating: number, tintPct = 15): string {
  return `color-mix(in srgb, ${ratingColorVar(rating)} ${tintPct}%, white)`;
}
