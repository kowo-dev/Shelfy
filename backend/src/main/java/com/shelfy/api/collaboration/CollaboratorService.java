package com.shelfy.api.collaboration;

import com.shelfy.api.auth.AvatarStorageService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.common.exception.ApiException;
import com.shelfy.api.common.exception.ConflictException;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ForbiddenException;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.federation.CollaboratorPublisher;
import com.shelfy.api.federation.CollectionPublisher;
import com.shelfy.api.follows.FollowRepository;
import com.shelfy.api.lists.ListCollaboratorStatus;
import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.notifications.NotificationType;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

public abstract class CollaboratorService<
    P extends Collaborative, C extends CollaboratorEntity, R> {
  private final CollaborationKind kind;
  private final JpaRepository<C, UUID> collaboratorRepository;
  private final FollowRepository followRepository;
  private final NotificationService notificationService;
  private final UserRepository userRepository;
  private final AvatarStorageService avatarStorageService;
  private final CollectionPublisher collectionPublisher;
  private final CollaboratorPublisher collaboratorPublisher;

  protected CollaboratorService(
      CollaborationKind kind,
      JpaRepository<C, UUID> collaboratorRepository,
      FollowRepository followRepository,
      NotificationService notificationService,
      UserRepository userRepository,
      AvatarStorageService avatarStorageService,
      CollectionPublisher collectionPublisher,
      CollaboratorPublisher collaboratorPublisher) {
    this.kind = kind;
    this.collaboratorRepository = collaboratorRepository;
    this.followRepository = followRepository;
    this.notificationService = notificationService;
    this.userRepository = userRepository;
    this.avatarStorageService = avatarStorageService;
    this.collectionPublisher = collectionPublisher;
    this.collaboratorPublisher = collaboratorPublisher;
  }

  protected abstract Optional<P> findParent(UUID parentId);

  protected abstract Optional<C> findCollaborator(UUID parentId, UUID userId);

  protected abstract List<C> findCollaborators(UUID parentId, ListCollaboratorStatus status);

  protected abstract C newCollaborator(P parent, UUID userId, UUID invitedBy);

  protected abstract R toResponse(C collaborator, UserEntity user, String avatarUrl);

  @Transactional
  public R invite(UUID ownerId, UUID parentId, UUID inviteeId) {
    P parent = getOwnedParent(ownerId, parentId);
    if (inviteeId.equals(ownerId)) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.CANNOT_INVITE_SELF_AS_COLLABORATOR,
          "You cannot invite yourself");
    }
    if (!followRepository.existsByFollowerIdAndFollowedId(inviteeId, ownerId)) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, kind.mustFollow(), "You can only invite people who follow you");
    }
    findCollaborator(parentId, inviteeId)
        .ifPresent(
            existing -> {
              throw new ConflictException(
                  kind.alreadyExists(), "This user is already invited or a collaborator");
            });
    C saved = collaboratorRepository.save(newCollaborator(parent, inviteeId, ownerId));
    notificationService.create(
        inviteeId,
        ownerId,
        kind.inviteNotification(),
        kind.notificationTarget(),
        parentId,
        Map.of(kind.nameParam(), parent.getName()));
    collectionPublisher.invited(kind.commentTarget(), parentId, ownerId, inviteeId);
    return response(saved);
  }

  @Transactional
  public R accept(UUID userId, UUID parentId) {
    C collaborator = getPendingInvite(userId, parentId);
    collaborator.accept();
    C saved = collaboratorRepository.save(collaborator);
    notificationService.resolve(
        userId, kind.inviteNotification(), kind.notificationTarget(), parentId, "ACCEPTED");
    notificationService.create(
        collaborator.getInvitedBy(),
        userId,
        kind.acceptedNotification(),
        kind.notificationTarget(),
        parentId,
        Map.of(kind.nameParam(), collaborator.parent().getName()));
    collaboratorPublisher.answered(
        kind.commentTarget(), parentId, collaborator.parent().getUserId(), userId, true);
    return response(saved);
  }

  @Transactional
  public void decline(UUID userId, UUID parentId) {
    C collaborator = getPendingInvite(userId, parentId);
    collaboratorPublisher.answered(
        kind.commentTarget(), parentId, collaborator.parent().getUserId(), userId, false);
    notificationService.resolve(
        userId, kind.inviteNotification(), kind.notificationTarget(), parentId, "DECLINED");
    notificationService.create(
        collaborator.getInvitedBy(),
        userId,
        NotificationType.COLLABORATION_DECLINED,
        kind.notificationTarget(),
        parentId,
        Map.of());
    collaboratorRepository.delete(collaborator);
  }

  @Transactional
  public void remove(UUID actingUserId, UUID parentId, UUID collaboratorUserId) {
    P parent = getParent(parentId);
    boolean isOwner = parent.getUserId().equals(actingUserId);
    boolean isSelfRemoval = actingUserId.equals(collaboratorUserId);
    if (!isOwner && !isSelfRemoval) {
      throw new ForbiddenException(ErrorCode.UNAUTHORIZED, "You cannot remove this collaborator");
    }
    C collaborator =
        findCollaborator(parentId, collaboratorUserId)
            .orElseThrow(
                () ->
                    new ResourceNotFoundException(
                        kind.collaboratorNotFound(), "Collaborator not found"));
    if (isOwner) {
      collaboratorPublisher.removedByOwner(
          kind.commentTarget(), parentId, actingUserId, collaboratorUserId);
    } else {
      collaboratorPublisher.answered(
          kind.commentTarget(), parentId, parent.getUserId(), actingUserId, false);
    }
    notifyRemoval(
        collaborator.getStatus() == ListCollaboratorStatus.PENDING,
        isOwner,
        parent,
        actingUserId,
        collaboratorUserId);
    collaboratorRepository.delete(collaborator);
  }

  @Transactional(readOnly = true)
  public List<R> listPendingInvites(UUID parentId) {
    return findCollaborators(parentId, ListCollaboratorStatus.PENDING).stream()
        .map(this::response)
        .toList();
  }

  @Transactional(readOnly = true)
  public List<R> listCollaborators(UUID parentId) {
    return findCollaborators(parentId, ListCollaboratorStatus.ACCEPTED).stream()
        .map(this::response)
        .toList();
  }

  private P getParent(UUID parentId) {
    return findParent(parentId)
        .orElseThrow(
            () ->
                new ResourceNotFoundException(
                    kind.notFound(), StringUtils.capitalize(kind.noun()) + " not found"));
  }

  private P getOwnedParent(UUID ownerId, UUID parentId) {
    P parent = getParent(parentId);
    if (!parent.getUserId().equals(ownerId)) {
      throw new ForbiddenException(
          ErrorCode.UNAUTHORIZED, "Only the " + kind.noun() + " owner can manage collaborators");
    }
    return parent;
  }

  private C getPendingInvite(UUID userId, UUID parentId) {
    return findCollaborator(parentId, userId)
        .filter(c -> c.getStatus() == ListCollaboratorStatus.PENDING)
        .orElseThrow(
            () ->
                new ResourceNotFoundException(kind.collaboratorNotFound(), "Invitation not found"));
  }

  private R response(C collaborator) {
    UserEntity user = userRepository.getReferenceById(collaborator.getUserId());
    return toResponse(collaborator, user, avatarStorageService.urlFor(user.getAvatarFilename()));
  }

  private void notifyRemoval(
      boolean pending, boolean byOwner, P parent, UUID actingUserId, UUID collaboratorUserId) {
    if (pending && byOwner) {
      notificationService.withdraw(
          collaboratorUserId, kind.inviteNotification(), kind.notificationTarget(), parent.getId());
      return;
    }
    if (pending) {
      return;
    }
    notificationService.create(
        byOwner ? collaboratorUserId : parent.getUserId(),
        actingUserId,
        NotificationType.COLLABORATION_REMOVED,
        kind.notificationTarget(),
        parent.getId(),
        Map.of("left", !byOwner));
  }
}
