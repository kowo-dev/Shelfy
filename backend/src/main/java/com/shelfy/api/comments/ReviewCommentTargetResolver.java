package com.shelfy.api.comments;

import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.collection.UserMediaEntity;
import com.shelfy.api.collection.UserMediaRepository;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.people.VisibilityPolicy;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class ReviewCommentTargetResolver implements CommentTargetResolver {
  private final UserMediaRepository userMediaRepository;
  private final UserRepository userRepository;
  private final VisibilityPolicy visibilityPolicy;

  @Override
  public CommentTargetType targetType() {
    return CommentTargetType.REVIEW;
  }

  @Override
  public void assertVisible(UUID viewerId, UUID targetId) {
    UserMediaEntity review = getReview(targetId);
    UserEntity author = getAuthor(review);
    if (!visibilityPolicy.canViewProfile(viewerId, author)) {
      throw new ResourceNotFoundException(ErrorCode.COLLECTION_ITEM_NOT_FOUND, "Review not found");
    }
  }

  @Override
  public boolean canModerate(UUID targetId, UUID userId) {
    return getReview(targetId).getUserId().equals(userId);
  }

  @Override
  public UUID ownerId(UUID targetId) {
    return getReview(targetId).getUserId();
  }

  private UserMediaEntity getReview(UUID targetId) {
    return userMediaRepository
        .findById(targetId)
        .orElseThrow(
            () ->
                new ResourceNotFoundException(
                    ErrorCode.COLLECTION_ITEM_NOT_FOUND, "Review not found"));
  }

  private UserEntity getAuthor(UserMediaEntity review) {
    return userRepository
        .findById(review.getUserId())
        .orElseThrow(
            () -> new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND, "User not found"));
  }
}
