import type { CommunityScope, CommunitySort } from '@app/core/services/community/community.model';

export type CommunityView = 'reviews' | 'lists' | 'versus';
type CreationKind = 'list' | 'versus';

export interface CommunityUrlState {
  view: CommunityView;
  scope: CommunityScope;
  sort: CommunitySort;
  query: string;
  create: CreationKind | null;
  toPeople: boolean;
}

interface ParamSource {
  get(name: string): string | null;
}

export const COMMUNITY_VIEWS: readonly CommunityView[] = ['reviews', 'lists', 'versus'];
const DEFAULT_VIEW: CommunityView = 'reviews';
export const COMMUNITY_SCOPES: readonly CommunityScope[] = ['ALL', 'CIRCLE', 'REMOTE', 'MINE'];

export function parseCommunityUrl(params: ParamSource, signedIn: boolean): CommunityUrlState {
  const f = params.get('f');
  const legacyMine = f === 'mine';
  const requestedView = legacyMine ? 'lists' : f;
  const view = COMMUNITY_VIEWS.find((candidate) => candidate === requestedView) ?? DEFAULT_VIEW;

  const raw = params.get('scope');
  const requested = legacyMine
    ? 'MINE'
    : (COMMUNITY_SCOPES.find((candidate) => candidate === raw) ?? 'ALL');
  const scope = signedIn ? requested : 'ALL';

  const create = params.get('create');
  return {
    view,
    scope,
    sort: params.get('sort') === 'POPULAR' ? 'POPULAR' : 'RECENT',
    query: params.get('q') ?? '',
    create: signedIn && (create === 'list' || create === 'versus') ? create : null,
    toPeople: f === 'people',
  };
}

export function scopeParam(scope: CommunityScope): string | null {
  return scope === 'ALL' ? null : scope;
}

export function tabParams(
  next: CommunityView,
  current: CommunityScope,
): { f: string; scope: string | null } {
  return { f: next, scope: scopeParam(current) };
}
