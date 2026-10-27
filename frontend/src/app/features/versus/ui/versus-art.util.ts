import type { MediaResponse } from '@app/core/services/collection/collection.model';

export function versusYear(media: MediaResponse | null): string | null {
  const date = media?.metadata?.['releaseDate'];
  return typeof date === 'string' && /^\d{4}/.test(date) ? date.slice(0, 4) : null;
}

export function versusOverview(media: MediaResponse | null): string | null {
  const text = media?.metadata?.['overview'];
  if (typeof text !== 'string') return null;
  const plain = text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain || null;
}
