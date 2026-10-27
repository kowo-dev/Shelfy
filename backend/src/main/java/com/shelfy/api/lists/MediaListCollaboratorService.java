package com.shelfy.api.lists;

import com.shelfy.api.auth.AvatarStorageService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.collaboration.CollaborationKind;
import com.shelfy.api.collaboration.CollaboratorService;
import com.shelfy.api.comments.CommentTargetType;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.federation.CollaboratorPublisher;
import com.shelfy.api.federation.CollectionPublisher;
import com.shelfy.api.follows.FollowRepository;
import com.shelfy.api.lists.dto.MediaListCollaboratorResponseDto;
import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.notifications.NotificationType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class MediaListCollaboratorService
    extends CollaboratorService<
        MediaListEntity, MediaListCollaboratorEntity, MediaListCollaboratorResponseDto> {
  private static final CollaborationKind KIND =
      new CollaborationKind(
          "list",
          CommentTargetType.LIST,
          "LIST",
          "listName",
          NotificationType.LIST_COLLABORATION_INVITE,
          NotificationType.LIST_COLLABORATION_ACCEPTED,
          ErrorCode.LIST_NOT_FOUND,
          ErrorCode.LIST_COLLABORATOR_MUST_FOLLOW,
          ErrorCode.LIST_COLLABORATOR_ALREADY_EXISTS,
          ErrorCode.LIST_COLLABORATOR_NOT_FOUND);

  private final MediaListRepository listRepository;
  private final MediaListCollaboratorRepository collaboratorRepository;

  public MediaListCollaboratorService(
      MediaListRepository listRepository,
      MediaListCollaboratorRepository collaboratorRepository,
      FollowRepository followRepository,
      NotificationService notificationService,
      UserRepository userRepository,
      AvatarStorageService avatarStorageService,
      CollectionPublisher collectionPublisher,
      CollaboratorPublisher collaboratorPublisher) {
    super(
        KIND,
        collaboratorRepository,
        followRepository,
        notificationService,
        userRepository,
        avatarStorageService,
        collectionPublisher,
        collaboratorPublisher);
    this.listRepository = listRepository;
    this.collaboratorRepository = collaboratorRepository;
  }

  @Override
  protected Optional<MediaListEntity> findParent(UUID listId) {
    return listRepository.findById(listId);
  }

  @Override
  protected Optional<MediaListCollaboratorEntity> findCollaborator(UUID listId, UUID userId) {
    return collaboratorRepository.findByListIdAndUserId(listId, userId);
  }

  @Override
  protected List<MediaListCollaboratorEntity> findCollaborators(
      UUID listId, ListCollaboratorStatus status) {
    return collaboratorRepository.findByListIdAndStatus(listId, status);
  }

  @Override
  protected MediaListCollaboratorEntity newCollaborator(
      MediaListEntity list, UUID userId, UUID invitedBy) {
    return new MediaListCollaboratorEntity(list, userId, invitedBy);
  }

  @Override
  protected MediaListCollaboratorResponseDto toResponse(
      MediaListCollaboratorEntity collaborator, UserEntity user, String avatarUrl) {
    return new MediaListCollaboratorResponseDto(
        collaborator.getId(),
        collaborator.getList().getId(),
        user.getId(),
        user.getUsername(),
        user.getDisplayName(),
        avatarUrl,
        collaborator.getStatus(),
        collaborator.getInvitedBy(),
        collaborator.getCreatedAt(),
        collaborator.getUpdatedAt());
  }
}
