import type { MediaType } from '@app/core/services/collection/collection.model';
import type { IconName } from '@shared/ui/icon/icon-registry';

export const MEDIA_TYPE_ICON: Record<MediaType, IconName> = {
  movie: 'movie',
  tv_show: 'tv',
  game: 'game',
  anime: 'anime',
  manga: 'manga',
  webtoon: 'webtoon',
  book: 'book',
};
