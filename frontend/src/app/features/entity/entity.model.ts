import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import type { PersonCredit } from '@app/core/services/tmdb/tmdb.model';
import type { IconName } from '@shared/ui/icon/icon-registry';
import type { Observable } from 'rxjs';

export type EntityKind =
  | 'people'
  | 'staff'
  | 'characters'
  | 'companies'
  | 'networks'
  | 'studios'
  | 'game-companies'
  | 'franchises';

interface EntityHeader {
  name: string;
  description?: string;
  imageUrl?: string | null;
  subtitle?: string | null;
  icon: IconName;
}

export interface EntityItemsPage {
  items: CollectionItemResponse[];
  hasMore: boolean;
}

export interface EntityPageData extends EntityItemsPage {
  header: EntityHeader;
  credits?: PersonCredit[];
}

export interface EntitySource {
  load: (id: string) => Observable<EntityPageData>;
  more?: (id: string, page: number) => Observable<EntityItemsPage>;
}

export interface EntityGame {
  id: number;
  name: string;
  coverImageId: string | null;
  rating: number;
}
