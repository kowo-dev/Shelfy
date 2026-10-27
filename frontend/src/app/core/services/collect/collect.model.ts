import type { CollectionVisibility } from '@app/core/services/auth/auth.model';
import type { MediaType } from '@app/core/services/collection/collection.model';

export interface CollectTitle {
  provider: string;
  mediaType: MediaType;
  externalId: string;
  title: string;
}

export interface EditableCreation {
  id: string;
  name: string;
  visibility: CollectionVisibility;
  itemCount: number;
  covers: string[];
  isOwner: boolean;
  hasClips: boolean;
  containedId: string | null;
}
