package com.shelfy.api.comments;

import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.people.VisibilityPolicy;
import com.shelfy.api.versus.VersusPoolEntity;
import com.shelfy.api.versus.VersusPoolRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class VersusPoolCommentTargetResolver implements CommentTargetResolver {
  private final VersusPoolRepository poolRepository;
  private final VisibilityPolicy visibilityPolicy;

  @Override
  public CommentTargetType targetType() {
    return CommentTargetType.VERSUS_POOL;
  }

  @Override
  public void assertVisible(UUID viewerId, UUID targetId) {
    VersusPoolEntity pool = getPool(targetId);
    if (!visibilityPolicy.canView(viewerId, pool.getUserId(), pool.getVisibility())) {
      throw new ResourceNotFoundException(ErrorCode.VERSUS_POOL_NOT_FOUND, "Pool not found");
    }
  }

  @Override
  public boolean canModerate(UUID targetId, UUID userId) {
    return getPool(targetId).getUserId().equals(userId);
  }

  @Override
  public UUID ownerId(UUID targetId) {
    return getPool(targetId).getUserId();
  }

  private VersusPoolEntity getPool(UUID targetId) {
    return poolRepository
        .findById(targetId)
        .orElseThrow(
            () -> new ResourceNotFoundException(ErrorCode.VERSUS_POOL_NOT_FOUND, "Pool not found"));
  }
}
