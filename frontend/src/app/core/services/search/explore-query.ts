import type { Params, ParamMap } from '@angular/router';
import { isVisibleMediaType, type MediaType } from '@app/core/services/collection/collection.model';

export type ExploreSort = 'popular' | 'rating' | 'recent';

export interface ExploreCriterion {
  token: string;
  label: string | null;
}

export interface ExploreQuery {
  text: string;
  type: MediaType | null;
  with: ExploreCriterion[];
  without: ExploreCriterion[];
  from: number | null;
  to: number | null;
  sort: ExploreSort;
}

export type CriterionKind = 'shared' | 'catalog' | 'platform' | 'streaming';

export const EXPLORE_SORTS: ExploreSort[] = ['popular', 'rating', 'recent'];
export const MAX_EXPLORE_CRITERIA = 12;
const LABEL_SEPARATOR = '~';
const MEDIA_TYPES: MediaType[] = ['movie', 'tv_show', 'anime', 'manga', 'webtoon', 'game'];

export const EMPTY_EXPLORE_QUERY: ExploreQuery = {
  text: '',
  type: null,
  with: [],
  without: [],
  from: null,
  to: null,
  sort: 'popular',
};

export function criterionKind(token: string): CriterionKind {
  if (!token.includes(':')) return 'shared';
  if (token.startsWith('platform:')) return 'platform';
  if (token.startsWith('streaming:')) return 'streaming';
  return 'catalog';
}

function hasCriteria(query: ExploreQuery): boolean {
  return (
    query.with.length > 0 || query.without.length > 0 || query.from !== null || query.to !== null
  );
}

export function isBlankQuery(query: ExploreQuery): boolean {
  return !query.text.trim() && !hasCriteria(query) && query.type === null;
}

export function exploreQueryKey(query: ExploreQuery): string {
  return JSON.stringify([
    query.text.trim(),
    query.type,
    query.with.map((c) => c.token),
    query.without.map((c) => c.token),
    query.from,
    query.to,
    query.sort,
  ]);
}

export function exploreApiParams(query: ExploreQuery): [string, string][] {
  const params: [string, string][] = [['sort', query.sort]];
  if (query.text.trim()) params.push(['query', query.text.trim()]);
  if (query.type) params.push(['type', query.type]);
  for (const criterion of query.with) params.push(['with', criterion.token]);
  for (const criterion of query.without) params.push(['without', criterion.token]);
  if (query.from !== null) params.push(['from', String(query.from)]);
  if (query.to !== null) params.push(['to', String(query.to)]);
  return params;
}

export function toRouteParams(query: ExploreQuery): Params {
  const encode = (criterion: ExploreCriterion) =>
    criterion.label ? `${criterion.token}${LABEL_SEPARATOR}${criterion.label}` : criterion.token;
  return {
    q: query.text.trim() || null,
    type: query.type,
    with: query.with.length ? query.with.map(encode) : null,
    without: query.without.length ? query.without.map(encode) : null,
    from: query.from,
    to: query.to,
    sort: query.sort === 'popular' ? null : query.sort,
  };
}

export function fromRouteParams(params: ParamMap): ExploreQuery {
  const type = params.get('type') as MediaType | null;
  const sort = params.get('sort') as ExploreSort | null;
  const decode = (value: string): ExploreCriterion => {
    const separator = value.indexOf(LABEL_SEPARATOR);
    return separator < 0
      ? { token: value, label: null }
      : { token: value.slice(0, separator), label: value.slice(separator + 1) || null };
  };
  const criteria = (key: string) =>
    params
      .getAll(key)
      .filter((value) => value.length > 0 && value.length <= 160)
      .map(decode)
      .filter(
        (criterion, index, all) => all.findIndex((c) => c.token === criterion.token) === index,
      )
      .slice(0, MAX_EXPLORE_CRITERIA);
  const year = (key: string) => {
    const value = Number(params.get(key));
    return Number.isInteger(value) && value >= 1870 && value <= 2100 ? value : null;
  };
  const from = year('from');
  const to = year('to');
  return {
    text: (params.get('q') ?? '').slice(0, 200),
    type: type && MEDIA_TYPES.includes(type) && isVisibleMediaType(type) ? type : null,
    with: criteria('with'),
    without: criteria('without'),
    from: from !== null && to !== null && from > to ? to : from,
    to: from !== null && to !== null && from > to ? from : to,
    sort: sort && EXPLORE_SORTS.includes(sort) ? sort : 'popular',
  };
}
