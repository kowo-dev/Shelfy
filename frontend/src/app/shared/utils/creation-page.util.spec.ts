import { creationVisibilityInfo, isSharedCreation } from './creation-page.util';

describe('creation visibility', () => {
  const alone = { collaborators: [], pendingInvites: [], viewerCollaboratorStatus: null };

  it('treats a creation with a co-author, an invite or a collaborating viewer as shared', () => {
    expect(isSharedCreation(alone)).toBe(false);
    expect(isSharedCreation({ ...alone, collaborators: [{}] })).toBe(true);
    expect(isSharedCreation({ ...alone, pendingInvites: [{}] })).toBe(true);
    expect(isSharedCreation({ ...alone, viewerCollaboratorStatus: 'PENDING' })).toBe(true);
  });

  it('says a private creation is only mine unless it is shared', () => {
    expect(creationVisibilityInfo('private').labelKey).toBe('lists.private');
    expect(creationVisibilityInfo('private', true).labelKey).toBe('lists.private_shared');
    expect(creationVisibilityInfo('public', true).labelKey).toBe('lists.public');
  });
});
