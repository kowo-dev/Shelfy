package com.shelfy.api.comments;

import java.util.UUID;

interface CommentTargetResolver {
  CommentTargetType targetType();

  void assertVisible(UUID viewerId, UUID targetId);

  boolean canModerate(UUID targetId, UUID userId);

  UUID ownerId(UUID targetId);

  default void onCommentCreated(UUID authorId, UUID targetId) {}
}
