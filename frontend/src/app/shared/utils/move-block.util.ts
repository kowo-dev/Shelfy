export type MoveTarget = 'top' | 'up' | 'down' | 'bottom' | number;

export function moveBlock(length: number, moving: readonly number[], target: MoveTarget): number[] {
  const set = new Set(moving);
  const block = [...set].sort((a, b) => a - b);
  const rest = Array.from({ length }, (_, i) => i).filter((i) => !set.has(i));
  if (block.length === 0 || (typeof target === 'number' && set.has(target))) {
    return Array.from({ length }, (_, i) => i);
  }
  const above = (index: number) => rest.filter((i) => i < index).length;
  let slot: number;
  if (target === 'top') slot = 0;
  else if (target === 'bottom') slot = rest.length;
  else if (target === 'up') slot = Math.max(0, above(block[0]) - 1);
  else if (target === 'down') slot = Math.min(rest.length, above(block[block.length - 1]) + 1);
  else slot = rest.indexOf(target) + (target > block[0] ? 1 : 0);
  return [...rest.slice(0, slot), ...block, ...rest.slice(slot)];
}
