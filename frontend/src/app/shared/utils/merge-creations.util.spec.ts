import type { MediaListResponse } from '@app/core/services/lists/lists.model';
import type { ReviewResponse } from '@app/core/services/users/user-profile.model';
import type { VersusPoolSummaryResponse } from '@app/core/services/versus/versus.model';

import { mergeCreations } from './merge-creations.util';

const list = (id: string, createdAt: string) =>
  ({ id, name: `List ${id}`, media: [], tags: [], createdAt }) as unknown as MediaListResponse;
const pool = (id: string, createdAt: string) =>
  ({
    id,
    name: `Pool ${id}`,
    previewEntries: [],
    itemCount: 3,
    createdAt,
  }) as unknown as VersusPoolSummaryResponse;
const review = (id: string, createdAt: string) => ({ id, createdAt }) as unknown as ReviewResponse;

describe('mergeCreations', () => {
  it('interleaves lists and versus, newest first', () => {
    const merged = mergeCreations(
      [list('l1', '2025-01-01T00:00:00Z'), list('l2', '2025-03-01T00:00:00Z')],
      [pool('v1', '2025-02-01T00:00:00Z')],
    );
    expect(merged.map((entry) => `${entry.kind}:${entry.id}`)).toEqual([
      'list:l2',
      'versus:v1',
      'list:l1',
    ]);
  });

  it('mixes reviews in by creation date', () => {
    const merged = mergeCreations(
      [list('l1', '2025-01-01T00:00:00Z')],
      [pool('v1', '2025-02-01T00:00:00Z')],
      [review('r1', '2025-02-15T00:00:00Z')],
    );
    expect(merged.map((entry) => entry.kind)).toEqual(['review', 'versus', 'list']);
  });
});
