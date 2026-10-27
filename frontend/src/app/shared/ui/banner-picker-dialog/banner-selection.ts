import { signal } from '@angular/core';
import type { SearchResult } from '@app/core/services/search/search.model';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { bannerKey, type BannerCandidate, type BannerImage } from './banner-picker-dialog';

const MAX_PARALLEL_COUNTS = 3;

export interface BannerSelectionDeps {
  imagesForMedia: (result: SearchResult) => Promise<BannerImage[]>;
  onError: ReturnType<typeof catchAndToastError>;
}

export function createBannerCounts(imagesForMedia: BannerSelectionDeps['imagesForMedia']) {
  const counts = signal<Record<string, number>>({});
  const queue: BannerCandidate[] = [];
  const requested = new Set<string>();
  let running = 0;

  function drain(): void {
    while (running < MAX_PARALLEL_COUNTS && queue.length > 0) {
      const next = queue.shift() as BannerCandidate;
      running++;
      void imagesForMedia(next.result)
        .then((found) => record(bannerKey(next), found.length))
        .catch(() => requested.delete(bannerKey(next)))
        .finally(() => {
          running--;
          drain();
        });
    }
  }

  function record(key: string, total: number): void {
    counts.update((current) => ({ ...current, [key]: total }));
  }

  function request(candidate: BannerCandidate): void {
    const key = bannerKey(candidate);
    if (key in counts() || requested.has(key)) return;
    requested.add(key);
    queue.push(candidate);
    drain();
  }

  return { counts: counts.asReadonly(), request, record };
}

export function createBannerSelection(
  { imagesForMedia, onError }: BannerSelectionDeps,
  record: (key: string, total: number) => void,
) {
  let request = 0;

  const selectedMedia = signal<BannerCandidate | null>(null);
  const images = signal<BannerImage[]>([]);
  const imagesLoading = signal(false);
  const selectedImage = signal<BannerImage | null>(null);
  const imagePosition = signal(50);

  async function loadImages(result: SearchResult, id: number): Promise<void> {
    try {
      const loaded = await imagesForMedia(result);
      if (id !== request) return;
      images.set(loaded);
      record(bannerKey({ result, coverUrl: null }), loaded.length);
    } catch (error) {
      if (id === request) onError(error);
    } finally {
      if (id === request) imagesLoading.set(false);
    }
  }

  function selectMedia(candidate: BannerCandidate): void {
    selectedMedia.set(candidate);
    images.set([]);
    imagesLoading.set(true);
    selectedImage.set(null);
    imagePosition.set(50);
    void loadImages(candidate.result, ++request);
  }

  function backToSearch(): void {
    request++;
    selectedMedia.set(null);
    images.set([]);
    imagesLoading.set(false);
    selectedImage.set(null);
  }

  function selectImage(image: BannerImage): void {
    selectedImage.set(image);
    imagePosition.set(50);
  }

  function reset(): void {
    backToSearch();
    imagePosition.set(50);
  }

  return {
    state: {
      selectedMedia: selectedMedia.asReadonly(),
      images: images.asReadonly(),
      imagesLoading: imagesLoading.asReadonly(),
      selectedImage: selectedImage.asReadonly(),
      imagePosition: imagePosition.asReadonly(),
      selectMedia,
      backToSearch,
      selectImage,
      setImagePosition: (position: number) =>
        imagePosition.set(Math.max(0, Math.min(100, position))),
    },
    selectedMedia,
    reset,
  };
}
