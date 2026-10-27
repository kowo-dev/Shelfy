import type { MediaResponse } from '@app/core/services/collection/collection.model';
import { imageRendition, type ImageRendition } from './image-rendition.util';

type BackdropMedia = Pick<MediaResponse, 'coverUrl' | 'metadata'>;

export function mediaBackdropUrl(
  media: BackdropMedia | null | undefined,
  rendition: ImageRendition = 'full',
): string | null {
  const backdrop = media?.metadata?.['backdropUrl'];
  const url = (typeof backdrop === 'string' && backdrop) || media?.coverUrl;
  return url ? imageRendition(url, rendition) : null;
}

export function featuredMediaBackdropUrl(
  media: Iterable<BackdropMedia | null | undefined>,
): string | null {
  for (const item of media) {
    const backdrop = item?.metadata?.['backdropUrl'];
    if (typeof backdrop === 'string' && backdrop) return mediaBackdropUrl(item);
  }
  return null;
}
