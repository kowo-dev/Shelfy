import type {
  CollectionItemResponse,
  MediaResponse,
} from '@app/core/services/collection/collection.model';

export function toPlaceholderCollectionItem(media: MediaResponse): CollectionItemResponse {
  return {
    id: media.id,
    userId: '',
    media,
    status: 'planned',
    rating: null,
    note: null,
    containsSpoilers: false,
    progress: {},
    createdAt: '',
    updatedAt: '',
  };
}
