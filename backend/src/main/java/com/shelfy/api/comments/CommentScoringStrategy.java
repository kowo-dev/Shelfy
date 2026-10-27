package com.shelfy.api.comments;

public interface CommentScoringStrategy {
  double relevanceScore(int upvotes, int downvotes);
}
