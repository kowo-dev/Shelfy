import type { MediaType } from '@app/core/services/collection/collection.model';
import { MEDIA_TYPE_ICON } from './media-type-icon.util';

describe('MEDIA_TYPE_ICON', () => {
  it('maps every media type to a defined icon name', () => {
    const types: MediaType[] = ['movie', 'tv_show', 'game', 'anime', 'manga', 'webtoon', 'book'];

    for (const type of types) {
      expect(MEDIA_TYPE_ICON[type]).toBeTruthy();
    }
  });

  it('maps movie to the movie icon', () => {
    expect(MEDIA_TYPE_ICON.movie).toBe('movie');
  });

  it('maps tv_show to the tv icon', () => {
    expect(MEDIA_TYPE_ICON.tv_show).toBe('tv');
  });
});
