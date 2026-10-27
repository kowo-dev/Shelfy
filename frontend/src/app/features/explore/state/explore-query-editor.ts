import type { MediaType } from '@app/core/services/collection/collection.model';
import type { ExploreCatalogService } from '@app/core/services/search/explore-catalog';
import {
  EXPLORE_SORTS,
  MAX_EXPLORE_CRITERIA,
  type ExploreCriterion,
  type ExploreQuery,
  type ExploreSort,
} from '@app/core/services/search/explore-query';
import type { ExploreChip } from '../ui/explore-omnibox/explore-omnibox';
import type { CriterionState, YearRange } from '../ui/explore-filters/explore-filters';

function sameCatalog(criterion: ExploreCriterion, type: MediaType): boolean {
  const token = criterion.token;
  if (token.startsWith('tmdb-')) return type === 'movie' || type === 'tv_show';
  if (token.startsWith('anilist-'))
    return type === 'anime' || type === 'manga' || type === 'webtoon';
  if (token.startsWith('igdb-')) return type === 'game';
  return true;
}

export function createExploreQueryEditor(
  catalog: ExploreCatalogService,
  query: () => ExploreQuery,
  update: (change: Partial<ExploreQuery>) => void,
) {
  function setCriterionState(criterion: ExploreCriterion, state: CriterionState): void {
    const current = query();
    const withList = current.with.filter((c) => c.token !== criterion.token);
    const withoutList = current.without.filter((c) => c.token !== criterion.token);
    if (state !== 'off' && withList.length + withoutList.length >= MAX_EXPLORE_CRITERIA) return;
    update({
      with: state === 'include' ? [...withList, criterion] : withList,
      without: state === 'exclude' ? [...withoutList, criterion] : withoutList,
    });
  }

  function setType(type: MediaType | null): void {
    const current = query();
    const keep = (criterion: ExploreCriterion) =>
      type === null
        ? !/^(tmdb|anilist|igdb)-/.test(criterion.token)
        : catalog.supports(criterion, type) && sameCatalog(criterion, type);
    update({
      type,
      with: current.with.filter(keep),
      without: current.without.filter(keep),
    });
  }

  return {
    setCriterionState,
    setType,
    selectTypeTab: (id: string) => setType(id === 'all' ? null : (id as MediaType)),
    addCriterion(criterion: ExploreCriterion): void {
      const current = query();
      if (current.with.length + current.without.length >= MAX_EXPLORE_CRITERIA) return;
      update({
        with: [...current.with.filter((c) => c.token !== criterion.token), criterion],
        without: current.without.filter((c) => c.token !== criterion.token),
      });
    },
    removeChip: (chip: ExploreChip) => setCriterionState(chip.criterion, 'off'),
    setText: (text: string) => update({ text }),
    setYears: (range: YearRange) => update({ from: range.from, to: range.to }),
    setSort(sort: string): void {
      if (EXPLORE_SORTS.includes(sort as ExploreSort)) update({ sort: sort as ExploreSort });
    },
    clearFilters: () => update({ with: [], without: [], from: null, to: null }),
  };
}
