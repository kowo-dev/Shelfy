import { countLive, findComment, mapComment, removeComment } from './comment-tree';
import type { CommentItem } from './comments.model';

const node = (id: string, replies: CommentItem[] = [], deleted = false): CommentItem => ({
  id,
  authorId: deleted ? null : 'u',
  authorUsername: deleted ? null : 'user',
  authorAvatarUrl: null,
  content: deleted ? '' : id,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: null,
  upvotes: 0,
  downvotes: 0,
  myVote: null,
  parentCommentId: null,
  isDeleted: deleted,
  replies,
});

describe('comment-tree', () => {
  const tree = [node('a', [node('b', [node('c')])]), node('d')];

  it('mapComment() updates a nested node and leaves the rest intact', () => {
    const next = mapComment(tree, 'c', (c) => ({ ...c, content: 'edited' }));
    expect(findComment(next, 'c')?.content).toBe('edited');
    expect(findComment(next, 'd')?.content).toBe('d');
  });

  it('removeComment() drops a node and prunes deleted ancestors left empty', () => {
    const withPlaceholder = [node('a', [node('b', [node('c')], true)]), node('d')];
    const next = removeComment(withPlaceholder, 'c');
    expect(findComment(next, 'b')).toBeNull();
    expect(findComment(next, 'a')?.replies).toEqual([]);
  });

  it('countLive() counts every non-deleted node at any depth', () => {
    expect(countLive(tree)).toBe(4);
    expect(countLive([node('x', [node('y')], true)])).toBe(1);
  });
});
