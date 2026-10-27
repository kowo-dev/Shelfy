import type { AddTarget } from '@app/core/services/add-sheet/add-sheet';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';

export function buildAddTarget(item: CollectionItemResponse, typeLabel: string): AddTarget {
  const media = item.media;
  const release = media.metadata?.['releaseDate'] ?? media.metadata?.['releaseYear'];
  const year =
    typeof release === 'string' || typeof release === 'number' ? String(release).slice(0, 4) : null;
  return {
    provider: media.provider,
    mediaType: media.mediaType,
    externalId: media.externalId,
    title: media.title,
    coverUrl: media.coverUrl,
    subtitle: [typeLabel, year].filter(Boolean).join(' · ') || null,
  };
}
