import type { MediaType } from '@app/core/services/collection/collection.model';

export type MediaLogKind = 'watch' | 'read' | 'play';

export function mediaLogKind(mediaType: MediaType): MediaLogKind {
  switch (mediaType) {
    case 'book':
    case 'manga':
    case 'webtoon':
      return 'read';
    case 'game':
      return 'play';
    default:
      return 'watch';
  }
}
