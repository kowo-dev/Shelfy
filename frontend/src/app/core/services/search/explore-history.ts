import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { AuthService } from '@app/core/services/auth/auth';
import { LocalStorageService } from '@app/core/services/local-storage/local-storage';
import {
  EMPTY_EXPLORE_QUERY,
  exploreQueryKey,
  EXPLORE_SORTS,
  isBlankQuery,
  type ExploreCriterion,
  type ExploreQuery,
} from './explore-query';

const MAX_RECENT = 6;

function parseCriteria(value: unknown): ExploreCriterion[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is ExploreCriterion =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as ExploreCriterion).token === 'string' &&
        ((item as ExploreCriterion).label === null ||
          typeof (item as ExploreCriterion).label === 'string'),
    )
    .slice(0, 12);
}

export function parseStoredQuery(value: unknown): ExploreQuery | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const year = (input: unknown) =>
    typeof input === 'number' && Number.isInteger(input) ? input : null;
  const query: ExploreQuery = {
    ...EMPTY_EXPLORE_QUERY,
    text: typeof raw['text'] === 'string' ? raw['text'].slice(0, 200) : '',
    type: typeof raw['type'] === 'string' ? (raw['type'] as ExploreQuery['type']) : null,
    with: parseCriteria(raw['with']),
    without: parseCriteria(raw['without']),
    from: year(raw['from']),
    to: year(raw['to']),
    sort: EXPLORE_SORTS.includes(raw['sort'] as ExploreQuery['sort'])
      ? (raw['sort'] as ExploreQuery['sort'])
      : 'popular',
  };
  return isBlankQuery(query) ? null : query;
}

@Injectable({ providedIn: 'root' })
export class ExploreHistoryService {
  private readonly storage = inject(LocalStorageService);
  private readonly auth = inject(AuthService);
  private readonly prefix = computed(
    () => `shelfy.explore.${this.auth.currentUser()?.id ?? 'guest'}`,
  );

  readonly recent = signal<ExploreQuery[]>([]);
  readonly hideOwned = signal(false);

  constructor() {
    effect(() => {
      const prefix = this.prefix();
      untracked(() => {
        this.recent.set(this.read(`${prefix}.recent`));
        this.hideOwned.set(this.storage.getItem(`${prefix}.hideOwned`) === 'true');
      });
    });
  }

  remember(query: ExploreQuery): void {
    if (isBlankQuery(query)) return;
    this.recent.set(this.prepend(this.recent(), query, MAX_RECENT));
    this.write('recent', this.recent());
  }

  setHideOwned(hide: boolean): void {
    this.hideOwned.set(hide);
    this.storage.setItem(`${this.prefix()}.hideOwned`, String(hide));
  }

  private prepend(list: ExploreQuery[], query: ExploreQuery, max: number): ExploreQuery[] {
    const key = exploreQueryKey(query);
    return [query, ...list.filter((entry) => exploreQueryKey(entry) !== key)].slice(0, max);
  }

  private read(key: string): ExploreQuery[] {
    try {
      const raw: unknown = JSON.parse(this.storage.getItem(key) ?? '[]');
      return Array.isArray(raw)
        ? raw.map(parseStoredQuery).filter((query): query is ExploreQuery => query !== null)
        : [];
    } catch {
      return [];
    }
  }

  private write(suffix: string, list: ExploreQuery[]): void {
    this.storage.setItem(`${this.prefix()}.${suffix}`, JSON.stringify(list));
  }
}
