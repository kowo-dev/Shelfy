import { appendDistinct } from './append-distinct.util';

describe('appendDistinct', () => {
  const key = (item: { id: number }) => String(item.id);

  it('appends the new items and skips those already shown or repeated in the page', () => {
    expect(appendDistinct([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }, { id: 3 }], key)).toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);
  });
});
