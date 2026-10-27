export function netScore(upvotes: number, downvotes: number): number {
  return upvotes - downvotes;
}

export function displayScore(upvotes: number, downvotes: number): string | null {
  const score = netScore(upvotes, downvotes);
  return score >= 1 ? String(score) : null;
}

export function isLowVoted(upvotes: number, downvotes: number, threshold: number): boolean {
  return netScore(upvotes, downvotes) <= threshold;
}
