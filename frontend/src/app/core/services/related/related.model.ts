import type { SearchResult } from '@app/core/services/search/search.model';

type RelatedEntityKind =
  'people' | 'staff' | 'companies' | 'networks' | 'studios' | 'game-companies' | 'franchises';

export interface RelatedEntity {
  kind: RelatedEntityKind;
  id: string;
  name: string;
  role: string | null;
}

export type RelatedSection =
  | { kind: 'similar'; label: null; entity: null; items: SearchResult[]; hasMore: boolean }
  | {
      kind: 'franchise';
      label: string | null;
      entity: RelatedEntity | null;
      items: SearchResult[];
      hasMore: boolean;
    }
  | { kind: 'entity'; label: null; entity: RelatedEntity; items: SearchResult[]; hasMore: boolean };

export interface RelatedMediaResponse {
  sections: RelatedSection[];
}

export interface SimilarMediaResponse {
  results: SearchResult[];
  page: number;
  hasMore: boolean;
}
