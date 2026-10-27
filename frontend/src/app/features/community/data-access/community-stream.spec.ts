import type { MediaListSummaryResponse } from '@app/core/services/lists/lists.model';
import type { ReviewResponse } from '@app/core/services/users/user-profile.model';
import type { VersusPoolSummaryResponse } from '@app/core/services/versus/versus.model';
import { asCreations } from './community-stream';

describe('asCreations', () => {
  it('tags each creation with its kind and a key unique across kinds', () => {
    expect(asCreations.lists([{ id: '1' } as MediaListSummaryResponse])[0]).toMatchObject({
      kind: 'list',
      id: 'list-1',
    });
    expect(asCreations.versus([{ id: '1' } as VersusPoolSummaryResponse])[0].id).toBe('versus-1');
    expect(asCreations.reviews([{ id: '1' } as ReviewResponse])[0].id).toBe('review-1');
  });
});
