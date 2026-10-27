import { computed, inject, linkedSignal, resource, type Signal } from '@angular/core';
import {
  isVisibleMediaType,
  type CollectionItemResponse,
} from '@app/core/services/collection/collection.model';
import { imageRendition } from '@shared/utils/image-rendition.util';
import { ShelfArtService } from '@app/core/services/shelf-art/shelf-art';

const MAX_LOOKUPS = 12;

export function createShelfBackdrop(
  items: Signal<readonly CollectionItemResponse[]>,
  random: () => number = Math.random,
): Signal<string | null> {
  const art = inject(ShelfArtService);
  const picked = linkedSignal<readonly CollectionItemResponse[], CollectionItemResponse | null>({
    source: items,
    computation: (all, previous) => {
      const list = all.filter((item) => isVisibleMediaType(item.media.mediaType));
      const withArt = list.filter((item) => art.hasArt(item.media));
      const pool = withArt.length ? withArt : list.filter((item) => !!item.media.coverUrl);
      const kept = pool.find((item) => item.media.id === previous?.value?.media.id);
      return kept ?? (pool.length ? pool[Math.floor(random() * pool.length)] : null);
    },
  });
  const looked = resource({
    params: () => {
      const item = picked();
      if (!item || !art.needsLookup(item.media)) return undefined;
      const others = items().filter((other) => other !== item && art.hasArt(other.media));
      return [item, ...others].slice(0, MAX_LOOKUPS);
    },
    loader: async ({ params }) => {
      for (const candidate of params) {
        const url = await art.lookup(candidate.media);
        if (url) return url;
      }
      return null;
    },
  });
  return computed(() => {
    const item = picked();
    if (!item) return null;
    let url = art.storedBackdrop(item.media);
    if (!url && art.needsLookup(item.media)) {
      if (!looked.hasValue()) return null;
      url = looked.value();
    }
    url ??= item.media.coverUrl;
    return url ? imageRendition(url, 'full') : null;
  });
}
