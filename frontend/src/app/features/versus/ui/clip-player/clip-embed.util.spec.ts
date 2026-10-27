import type { VersusClip } from '@app/core/services/versus/versus.model';

import { clipEmbedUrl } from './clip-embed.util';

describe('clipEmbedUrl security', () => {
  const clip = (externalId: string): VersusClip => ({
    provider: 'youtube',
    externalId,
    title: 't',
    author: 'a',
    startSeconds: 0,
  });

  it('always points at the privacy-enhanced YouTube embed origin', () => {
    const url = new URL(clipEmbedUrl(clip('dQw4w9WgXcQ'), false, 'https://shelfy.test'));

    expect(url.origin).toBe('https://www.youtube-nocookie.com');
    expect(url.pathname).toBe('/embed/dQw4w9WgXcQ');
  });

  it('cannot be redirected to another host or path through the video id', () => {
    for (const id of ['../../evil', 'x?autoplay=1&y=', '@evil.com', 'a/b', '//evil.com']) {
      const url = new URL(clipEmbedUrl(clip(id), false, 'https://shelfy.test'));

      expect(url.origin).toBe('https://www.youtube-nocookie.com');
      expect(url.pathname.startsWith('/embed/')).toBe(true);
      expect(url.pathname.split('/')).toHaveLength(3);
    }
  });
});
