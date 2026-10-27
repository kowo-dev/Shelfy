package com.shelfy.api.versus;

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
import com.shelfy.api.lists.ListCollaboratorStatus;
import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.notifications.NotificationType;
import com.shelfy.api.versus.dto.VersusPoolCollaboratorResponseDto;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class VersusPoolCollaboratorService
    extends CollaboratorService<
        VersusPoolEntity, VersusPoolCollaboratorEntity, VersusPoolCollaboratorResponseDto> {
  private static final CollaborationKind KIND =
      new CollaborationKind(
          "pool",
          CommentTargetType.VERSUS_POOL,
          "VERSUS_POOL",
          "poolName",
          NotificationType.VERSUS_COLLABORATION_INVITE,
          NotificationType.VERSUS_COLLABORATION_ACCEPTED,
          ErrorCode.VERSUS_POOL_NOT_FOUND,
          ErrorCode.VERSUS_COLLABORATOR_MUST_FOLLOW,
          ErrorCode.VERSUS_COLLABORATOR_ALREADY_EXISTS,
          ErrorCode.VERSUS_COLLABORATOR_NOT_FOUND);

  private final VersusPoolRepository poolRepository;
  private final VersusPoolCollaboratorRepository collaboratorRepository;

  public VersusPoolCollaboratorService(
      VersusPoolRepository poolRepository,
      VersusPoolCollaboratorRepository collaboratorRepository,
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
    this.poolRepository = poolRepository;
    this.collaboratorRepository = collaboratorRepository;
  }

  @Override
  protected Optional<VersusPoolEntity> findParent(UUID poolId) {
    return poolRepository.findById(poolId);
  }

  @Override
  protected Optional<VersusPoolCollaboratorEntity> findCollaborator(UUID poolId, UUID userId) {
    return collaboratorRepository.findByPoolIdAndUserId(poolId, userId);
  }

  @Override
  protected List<VersusPoolCollaboratorEntity> findCollaborators(
      UUID poolId, ListCollaboratorStatus status) {
    return collaboratorRepository.findByPoolIdAndStatus(poolId, status);
  }

  @Override
  protected VersusPoolCollaboratorEntity newCollaborator(
      VersusPoolEntity pool, UUID userId, UUID invitedBy) {
    return new VersusPoolCollaboratorEntity(pool, userId, invitedBy);
  }

  @Override
  protected VersusPoolCollaboratorResponseDto toResponse(
      VersusPoolCollaboratorEntity collaborator, UserEntity user, String avatarUrl) {
    return new VersusPoolCollaboratorResponseDto(
        collaborator.getId(),
        collaborator.getPool().getId(),
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
