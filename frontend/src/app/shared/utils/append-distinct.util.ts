export function appendDistinct<T>(
  current: readonly T[],
  next: readonly T[],
  key: (item: T) => string,
): T[] {
  const seen = new Set(current.map(key));
  return [...current, ...next.filter((item) => !seen.has(key(item)) && seen.add(key(item)))];
}
