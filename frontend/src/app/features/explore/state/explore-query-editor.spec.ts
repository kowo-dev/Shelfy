import { vi } from 'vitest';
import type { ExploreCatalogService } from '@app/core/services/search/explore-catalog';
import {
  MAX_EXPLORE_CRITERIA,
  type ExploreCriterion,
  type ExploreQuery,
} from '@app/core/services/search/explore-query';
import { createExploreQueryEditor } from './explore-query-editor';

const crit = (token: string): ExploreCriterion => ({ token, label: null });

function setup(query: Partial<ExploreQuery> = {}, supports = true) {
  const current: ExploreQuery = {
    text: '',
    type: null,
    with: [],
    without: [],
    from: null,
    to: null,
    sort: 'popular',
    ...query,
  };
  const update = vi.fn();
  const catalog = {
    supports: vi.fn().mockReturnValue(supports),
  } as unknown as ExploreCatalogService;
  return { editor: createExploreQueryEditor(catalog, () => current, update), update, catalog };
}

describe('createExploreQueryEditor', () => {
  it('includes a criterion once and drops it from the excluded ones', () => {
    const { editor, update } = setup({ with: [crit('a')], without: [crit('b')] });

    editor.addCriterion(crit('b'));

    expect(update).toHaveBeenCalledWith({ with: [crit('a'), crit('b')], without: [] });
  });

  it('stops adding criteria at the limit', () => {
    const full = Array.from({ length: MAX_EXPLORE_CRITERIA }, (_, i) => crit(`c${i}`));
    const { editor, update } = setup({ with: full });

    editor.addCriterion(crit('extra'));
    editor.setCriterionState(crit('extra'), 'exclude');

    expect(update).not.toHaveBeenCalled();
  });

  it('still lets a full query turn a criterion off', () => {
    const full = Array.from({ length: MAX_EXPLORE_CRITERIA }, (_, i) => crit(`c${i}`));
    const { editor, update } = setup({ with: full });

    editor.setCriterionState(crit('c0'), 'off');

    expect(update.mock.calls[0][0].with).toHaveLength(MAX_EXPLORE_CRITERIA - 1);
  });

  it.each([
    ['include', { with: [crit('a')], without: [] }],
    ['exclude', { with: [], without: [crit('a')] }],
    ['off', { with: [], without: [] }],
  ] as const)('moves a criterion to %s', (state, expected) => {
    const { editor, update } = setup({ with: [crit('a')] });

    editor.setCriterionState(crit('a'), state);

    expect(update).toHaveBeenCalledWith(expected);
  });

  it('removing a chip turns its criterion off', () => {
    const { editor, update } = setup({ without: [crit('a')] });

    editor.removeChip({ criterion: crit('a') } as never);

    expect(update).toHaveBeenCalledWith({ with: [], without: [] });
  });

  it('keeps only the criteria the new type supports and that belong to its catalog', () => {
    const { editor, update, catalog } = setup({
      with: [crit('tmdb-1'), crit('anilist-2'), crit('shared')],
    });
    vi.mocked(catalog.supports).mockReturnValue(true);

    editor.setType('movie');

    expect(update).toHaveBeenCalledWith({
      type: 'movie',
      with: [crit('tmdb-1'), crit('shared')],
      without: [],
    });
  });

  it('drops catalog-specific criteria when going back to every type', () => {
    const { editor, update } = setup({ with: [crit('tmdb-1'), crit('shared')] });

    editor.selectTypeTab('all');

    expect(update).toHaveBeenCalledWith({ type: null, with: [crit('shared')], without: [] });
  });

  it('ignores a sort it does not know', () => {
    const { editor, update } = setup();

    editor.setSort('nonsense');
    editor.setSort('rating');

    expect(update).toHaveBeenCalledExactlyOnceWith({ sort: 'rating' });
  });

  it('clears criteria and years but keeps the text', () => {
    const { editor, update } = setup({ text: 'dune', with: [crit('a')], from: 1990 });

    editor.clearFilters();

    expect(update).toHaveBeenCalledWith({ with: [], without: [], from: null, to: null });
  });
});
