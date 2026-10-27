import type { CommentItem } from './comments.model';

export const mapComment = (
  items: CommentItem[],
  id: string,
  fn: (comment: CommentItem) => CommentItem,
): CommentItem[] =>
  items.map((comment) =>
    comment.id === id ? fn(comment) : { ...comment, replies: mapComment(comment.replies, id, fn) },
  );

export const removeComment = (items: CommentItem[], id: string): CommentItem[] =>
  items
    .filter((comment) => comment.id !== id)
    .map((comment) => ({ ...comment, replies: removeComment(comment.replies, id) }))
    .filter((comment) => !comment.isDeleted || comment.replies.length > 0);

export const findComment = (items: CommentItem[], id: string): CommentItem | null => {
  for (const comment of items) {
    if (comment.id === id) return comment;
    const found = findComment(comment.replies, id);
    if (found) return found;
  }
  return null;
};

export const countLive = (items: CommentItem[]): number =>
  items.reduce((sum, comment) => sum + (comment.isDeleted ? 0 : 1) + countLive(comment.replies), 0);
