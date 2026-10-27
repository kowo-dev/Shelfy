import { createSelectionState } from './selection-state';

describe('createSelectionState', () => {
  it('toggles items while selecting and forgets them on exit', () => {
    const selection = createSelectionState();

    selection.toggleSelectionMode();
    selection.toggleSelected('a');
    selection.toggleSelected('b');
    selection.toggleSelected('a');

    expect(selection.selectionMode()).toBe(true);
    expect([...selection.selected()]).toEqual(['b']);

    selection.toggleSelectionMode();

    expect(selection.selectionMode()).toBe(false);
    expect(selection.selected().size).toBe(0);
  });

  it('selects all and drops removed ids without leaving selection mode', () => {
    const selection = createSelectionState();
    selection.toggleSelectionMode();
    selection.selectAll(['a', 'b', 'c']);

    selection.deselect(new Set(['a', 'c']));

    expect([...selection.selected()]).toEqual(['b']);
    expect(selection.selectionMode()).toBe(true);
  });
});
