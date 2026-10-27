package com.shelfy.api.comments;

import com.shelfy.api.activity.ActivityType;
import com.shelfy.api.activity.UserActivityService;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.lists.MediaListAccess;
import com.shelfy.api.lists.MediaListEntity;
import com.shelfy.api.lists.MediaListRepository;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class ListCommentTargetResolver implements CommentTargetResolver {
  private final MediaListRepository listRepository;
  private final MediaListAccess listAccess;
  private final UserActivityService userActivityService;

  @Override
  public CommentTargetType targetType() {
    return CommentTargetType.LIST;
  }

  @Override
  public void assertVisible(UUID viewerId, UUID targetId) {
    MediaListEntity list = find(targetId);
    if (!listAccess.canView(viewerId, list)) {
      throw new ResourceNotFoundException(ErrorCode.LIST_NOT_FOUND, "List not found");
    }
  }

  @Override
  public boolean canModerate(UUID targetId, UUID userId) {
    return find(targetId).getUserId().equals(userId);
  }

  @Override
  public UUID ownerId(UUID targetId) {
    return find(targetId).getUserId();
  }

  @Override
  public void onCommentCreated(UUID authorId, UUID targetId) {
    MediaListEntity list = find(targetId);
    userActivityService.record(
        authorId,
        ActivityType.COMMENTED,
        Map.of("listId", list.getId().toString(), "listName", list.getName()));
  }

  private MediaListEntity find(UUID targetId) {
    return listRepository
        .findById(targetId)
        .orElseThrow(
            () -> new ResourceNotFoundException(ErrorCode.LIST_NOT_FOUND, "List not found"));
  }
}
