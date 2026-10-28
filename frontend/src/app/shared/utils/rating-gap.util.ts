const CLOSE_GAP = 1;
const FAR_GAP = 4;

interface RatingGap {
  kind: 'same' | 'close' | 'more' | 'less' | 'far';
  delta: number;
}

export function ratingGap(theirs: number | null, mine: number | null): RatingGap | null {
  if (!theirs || !mine) return null;
  const delta = mine - theirs;
  const size = Math.abs(delta);
  if (size === 0) return { kind: 'same', delta };
  if (size <= CLOSE_GAP) return { kind: 'close', delta };
  if (size >= FAR_GAP) return { kind: 'far', delta };
  return { kind: delta > 0 ? 'more' : 'less', delta };
}

export function formatGap(delta: number): string {
  const stars = (Math.abs(delta) / 2).toFixed(1).replace(/\.0$/, '');
  return (delta > 0 ? '+' : '−') + stars;
}
