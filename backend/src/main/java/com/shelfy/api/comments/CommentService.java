package com.shelfy.api.comments;

import com.shelfy.api.auth.AvatarStorageService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.comments.dto.CommentResponseDto;
import com.shelfy.api.comments.dto.CommentVoteRequestDto;
import com.shelfy.api.comments.dto.CreateCommentRequestDto;
import com.shelfy.api.common.IdCount;
import com.shelfy.api.common.dto.PagedResponseDto;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ForbiddenException;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.federation.FederationUris;
import com.shelfy.api.federation.InteractionPublisher;
import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.notifications.NotificationType;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CommentService {
  private static final String COMMENT_TARGET = "COMMENT";

  private final CommentRepository commentRepository;
  private final CommentVoteRepository commentVoteRepository;
  private final CommentScoringStrategy commentScoringStrategy;
  private final UserRepository userRepository;
  private final NotificationService notificationService;
  private final AvatarStorageService avatarStorageService;
  private final Map<CommentTargetType, CommentTargetResolver> resolvers;
  private final InteractionPublisher interactionPublisher;
  private final FederationUris federationUris;

  public CommentService(
      CommentRepository commentRepository,
      CommentVoteRepository commentVoteRepository,
      CommentScoringStrategy commentScoringStrategy,
      UserRepository userRepository,
      NotificationService notificationService,
      AvatarStorageService avatarStorageService,
      List<CommentTargetResolver> resolvers,
      InteractionPublisher interactionPublisher,
      FederationUris federationUris) {
    this.commentRepository = commentRepository;
    this.commentVoteRepository = commentVoteRepository;
    this.commentScoringStrategy = commentScoringStrategy;
    this.userRepository = userRepository;
    this.notificationService = notificationService;
    this.avatarStorageService = avatarStorageService;
    this.interactionPublisher = interactionPublisher;
    this.federationUris = federationUris;
    this.resolvers = new HashMap<>();
    for (CommentTargetResolver resolver : resolvers) {
      this.resolvers.put(resolver.targetType(), resolver);
    }
  }

  @Transactional
  public CommentResponseDto create(
      UUID userId, CommentTargetType targetType, UUID targetId, CreateCommentRequestDto request) {
    resolver(targetType).assertVisible(userId, targetId);
    CommentEntity parent = null;
    if (request.parentCommentId() != null) {
      parent = getComment(targetType, targetId, request.parentCommentId());
    }
    var author = userRepository.getReferenceById(userId);
    CommentEntity saved =
        commentRepository.save(
            new CommentEntity(targetType, targetId, author, request.content().trim(), parent));
    resolver(targetType).onCommentCreated(userId, targetId);
    notifyComment(saved, targetType, targetId, parent);
    interactionPublisher.commentCreated(saved);
    return commentResponse(saved, userId);
  }

  @Transactional(readOnly = true)
  public PagedResponseDto<CommentResponseDto> list(
      UUID userId,
      CommentTargetType targetType,
      UUID targetId,
      int page,
      int size,
      CommentSortMode sort) {
    resolver(targetType).assertVisible(userId, targetId);
    int safePage = Math.max(page, 0);
    int safeSize = Math.clamp(size, 1, 50);
    List<CommentEntity> comments =
        commentRepository.findWithAuthorsByTargets(targetType, List.of(targetId));
    List<CommentResponseDto> threads = threads(comments, myVotes(userId, comments), sort);
    int fromIndex = Math.min(safePage * safeSize, threads.size());
    int toIndex = Math.min(fromIndex + safeSize, threads.size());
    return new PagedResponseDto<>(
        threads.subList(fromIndex, toIndex), safePage, safeSize, threads.size());
  }

  @Transactional(readOnly = true)
  public List<CommentResponseDto> listTopByRelevance(
      CommentTargetType targetType, UUID targetId, UUID viewerId, int limit) {
    return listTopByRelevance(targetType, List.of(targetId), viewerId, limit)
        .getOrDefault(targetId, List.of());
  }

  @Transactional(readOnly = true)
  public Map<UUID, List<CommentResponseDto>> listTopByRelevance(
      CommentTargetType targetType, Collection<UUID> targetIds, UUID viewerId, int limit) {
    if (targetIds.isEmpty()) {
      return Map.of();
    }
    List<CommentEntity> comments =
        commentRepository.findWithAuthorsByTargets(targetType, targetIds);
    Map<UUID, Integer> myVotes = myVotes(viewerId, comments);
    Map<UUID, List<CommentResponseDto>> result = new HashMap<>();
    comments.stream()
        .collect(Collectors.groupingBy(CommentEntity::getTargetId))
        .forEach(
            (target, targetComments) ->
                result.put(
                    target,
                    threads(targetComments, myVotes, CommentSortMode.RELEVANCE).stream()
                        .limit(limit)
                        .toList()));
    return result;
  }

  @Transactional
  public void deleteAllForTarget(CommentTargetType targetType, UUID targetId) {
    List<CommentEntity> comments =
        commentRepository.findByTargetTypeAndTargetId(targetType, targetId);
    notificationService.deleteForTargets(
        COMMENT_TARGET, comments.stream().map(CommentEntity::getId).toList());
    commentRepository.deleteAll(comments);
  }

  @Transactional(readOnly = true)
  public long count(CommentTargetType targetType, UUID targetId) {
    return commentRepository.countByTargetTypeAndTargetIdAndDeletedAtIsNull(targetType, targetId);
  }

  @Transactional(readOnly = true)
  public Map<UUID, Long> count(CommentTargetType targetType, Collection<UUID> targetIds) {
    return targetIds.isEmpty()
        ? Map.of()
        : IdCount.toMap(commentRepository.countByTargets(targetType, targetIds));
  }

  private List<CommentResponseDto> threads(
      List<CommentEntity> comments, Map<UUID, Integer> myVotes, CommentSortMode sort) {
    Comparator<CommentEntity> order = order(sort);
    Set<UUID> ids = comments.stream().map(CommentEntity::getId).collect(Collectors.toSet());
    Map<UUID, List<CommentEntity>> children =
        comments.stream()
            .filter(c -> c.getParent() != null && ids.contains(c.getParent().getId()))
            .collect(Collectors.groupingBy(c -> c.getParent().getId()));
    return comments.stream()
        .filter(c -> c.getParent() == null || !ids.contains(c.getParent().getId()))
        .sorted(order)
        .map(root -> thread(root, children, myVotes, order))
        .filter(Objects::nonNull)
        .toList();
  }

  private CommentResponseDto thread(
      CommentEntity comment,
      Map<UUID, List<CommentEntity>> children,
      Map<UUID, Integer> myVotes,
      Comparator<CommentEntity> order) {
    List<CommentResponseDto> replies =
        children.getOrDefault(comment.getId(), List.of()).stream()
            .sorted(order)
            .map(child -> thread(child, children, myVotes, order))
            .filter(Objects::nonNull)
            .toList();
    if (comment.isDeleted() && replies.isEmpty()) {
      return null;
    }
    return toResponse(comment, myVotes.get(comment.getId()), replies);
  }

  private Comparator<CommentEntity> order(CommentSortMode sort) {
    Comparator<CommentEntity> newest =
        Comparator.comparing(CommentEntity::getCreatedAt, Comparator.reverseOrder());
    if (sort == CommentSortMode.RECENT) {
      return newest;
    }
    return Comparator.comparingDouble(
            (CommentEntity c) ->
                commentScoringStrategy.relevanceScore(c.getUpvotes(), c.getDownvotes()))
        .reversed()
        .thenComparing(newest);
  }

  @Transactional
  public CommentResponseDto vote(
      UUID userId,
      CommentTargetType targetType,
      UUID targetId,
      UUID commentId,
      CommentVoteRequestDto request) {
    if (request.value() != 1 && request.value() != -1) {
      throw new IllegalArgumentException("Vote value must be 1 or -1");
    }
    resolver(targetType).assertVisible(userId, targetId);
    CommentEntity comment = getCommentForVote(targetType, targetId, commentId, userId);
    var existing = commentVoteRepository.findByCommentIdAndUserId(commentId, userId);
    int previous = existing.map(CommentVoteEntity::getValue).orElse(0);
    if (existing.isPresent()) {
      existing.get().change(request.value());
    } else {
      commentVoteRepository.save(new CommentVoteEntity(comment, userId, request.value()));
    }
    notifyVote(comment, userId, previous, request.value());
    recomputeVoteCounts(comment);
    return commentResponse(commentRepository.save(comment), userId);
  }

  @Transactional
  public CommentResponseDto removeVote(
      UUID userId, CommentTargetType targetType, UUID targetId, UUID commentId) {
    resolver(targetType).assertVisible(userId, targetId);
    CommentEntity comment = getCommentForVote(targetType, targetId, commentId, userId);
    commentVoteRepository
        .findByCommentIdAndUserId(commentId, userId)
        .ifPresent(
            vote -> {
              notifyVote(comment, userId, vote.getValue(), 0);
              commentVoteRepository.delete(vote);
            });
    recomputeVoteCounts(comment);
    return commentResponse(commentRepository.save(comment), userId);
  }

  private CommentEntity getCommentForVote(
      CommentTargetType targetType, UUID targetId, UUID commentId, UUID userId) {
    CommentEntity comment =
        commentRepository
            .findByIdForVote(commentId)
            .orElseThrow(
                () ->
                    new ResourceNotFoundException(
                        ErrorCode.COMMENT_NOT_FOUND, "Comment not found"));
    assertActiveInTarget(comment, targetType, targetId);
    if (comment.isAuthoredBy(userId)) {
      throw new ForbiddenException(ErrorCode.UNAUTHORIZED, "You cannot vote on your own comment");
    }
    return comment;
  }

  private void recomputeVoteCounts(CommentEntity comment) {
    commentVoteRepository.flush();
    int upvotes = (int) commentVoteRepository.countByCommentIdAndValue(comment.getId(), 1);
    int downvotes = (int) commentVoteRepository.countByCommentIdAndValue(comment.getId(), -1);
    comment.updateVoteCounts(upvotes, downvotes);
  }

  @Transactional
  public CommentResponseDto update(
      UUID userId,
      CommentTargetType targetType,
      UUID targetId,
      UUID commentId,
      CreateCommentRequestDto request) {
    resolver(targetType).assertVisible(userId, targetId);
    CommentEntity comment = getComment(targetType, targetId, commentId);
    if (!comment.isAuthoredBy(userId)) {
      throw new ForbiddenException(ErrorCode.UNAUTHORIZED, "You cannot edit this comment");
    }
    comment.edit(request.content().trim());
    CommentEntity saved = commentRepository.save(comment);
    interactionPublisher.commentUpdated(saved);
    return commentResponse(saved, userId);
  }

  @Transactional
  public void delete(UUID userId, CommentTargetType targetType, UUID targetId, UUID commentId) {
    resolver(targetType).assertVisible(userId, targetId);
    CommentEntity comment = getComment(targetType, targetId, commentId);
    boolean canModerate = resolver(targetType).canModerate(targetId, userId);
    if (!comment.isAuthoredBy(userId) && !canModerate) {
      throw new ForbiddenException(ErrorCode.UNAUTHORIZED, "You cannot delete this comment");
    }
    interactionPublisher.commentDeleted(comment);
    notificationService.deleteForTargets(COMMENT_TARGET, List.of(comment.getId()));
    if (commentRepository.existsByParentId(comment.getId())) {
      comment.markDeleted();
      commentRepository.save(comment);
    } else {
      commentRepository.delete(comment);
    }
  }

  private CommentEntity getComment(CommentTargetType targetType, UUID targetId, UUID commentId) {
    CommentEntity comment =
        commentRepository
            .findById(commentId)
            .orElseThrow(
                () ->
                    new ResourceNotFoundException(
                        ErrorCode.COMMENT_NOT_FOUND, "Comment not found"));
    assertActiveInTarget(comment, targetType, targetId);
    return comment;
  }

  private void assertActiveInTarget(
      CommentEntity comment, CommentTargetType targetType, UUID targetId) {
    if (comment.isDeleted()
        || comment.getTargetType() != targetType
        || !comment.getTargetId().equals(targetId)) {
      throw new ResourceNotFoundException(ErrorCode.COMMENT_NOT_FOUND, "Comment not found");
    }
  }

  private CommentTargetResolver resolver(CommentTargetType targetType) {
    CommentTargetResolver resolver = resolvers.get(targetType);
    if (resolver == null) {
      throw new IllegalStateException("No comment target resolver for " + targetType);
    }
    return resolver;
  }

  private void notifyComment(
      CommentEntity comment, CommentTargetType targetType, UUID targetId, CommentEntity parent) {
    UUID authorId = comment.getAuthor().getId();
    Set<UUID> notified = new HashSet<>(Set.of(authorId));
    if (parent != null && notified.add(parent.getAuthor().getId())) {
      notifyAbout(comment, parent.getAuthor().getId(), NotificationType.COMMENT_REPLY);
    }
    for (UserEntity user : mentionedUsers(comment)) {
      if (notified.add(user.getId())) {
        notifyAbout(comment, user.getId(), NotificationType.COMMENT_MENTION);
      }
    }
    UUID ownerId = resolver(targetType).ownerId(targetId);
    if (notified.add(ownerId)) {
      notifyAbout(comment, ownerId, NotificationType.COMMENT_ON_CREATION);
    }
    for (UUID participant : commentRepository.findLocalAuthorIds(targetType, targetId)) {
      if (notified.add(participant)) {
        notifyAbout(comment, participant, NotificationType.COMMENT_IN_THREAD);
      }
    }
  }

  private void notifyAbout(CommentEntity comment, UUID recipientId, NotificationType type) {
    notificationService.create(
        recipientId, comment.getAuthor().getId(), type, COMMENT_TARGET, comment.getId(), Map.of());
  }

  private List<UserEntity> mentionedUsers(CommentEntity comment) {
    Set<String> usernames =
        new LinkedHashSet<>(MentionParser.extractMentionedUsernames(comment.getContent()));
    usernames.addAll(
        federationUris.localUsernames(MentionParser.extractRemoteHandles(comment.getContent())));
    return usernames.isEmpty()
        ? List.of()
        : userRepository.findByUsernameIgnoreCaseInAndDomainIsNull(usernames);
  }

  private void notifyVote(CommentEntity comment, UUID voterId, int previous, int next) {
    if (previous == next) {
      return;
    }
    UUID authorId = comment.getAuthor().getId();
    if (next == 1) {
      notificationService.create(
          authorId,
          voterId,
          NotificationType.COMMENT_UPVOTED,
          COMMENT_TARGET,
          comment.getId(),
          Map.of());
    } else if (previous == 1) {
      notificationService.retract(
          authorId, voterId, NotificationType.COMMENT_UPVOTED, COMMENT_TARGET, comment.getId());
    }
  }

  private CommentResponseDto commentResponse(CommentEntity comment, UUID viewerId) {
    return toResponse(comment, myVotes(viewerId, List.of(comment)).get(comment.getId()), List.of());
  }

  private Map<UUID, Integer> myVotes(UUID viewerId, List<CommentEntity> comments) {
    if (viewerId == null || comments.isEmpty()) {
      return Map.of();
    }
    return commentVoteRepository
        .findByUserIdAndCommentIds(viewerId, comments.stream().map(CommentEntity::getId).toList())
        .stream()
        .collect(Collectors.toMap(vote -> vote.getComment().getId(), CommentVoteEntity::getValue));
  }

  private CommentResponseDto toResponse(
      CommentEntity comment, Integer myVote, List<CommentResponseDto> replies) {
    UserEntity author = comment.isDeleted() ? null : comment.getAuthor();
    CommentEntity parent = comment.getParent();
    return new CommentResponseDto(
        comment.getId(),
        author == null ? null : author.getId(),
        author == null ? null : author.getUsername(),
        author == null ? null : avatarStorageService.urlFor(author.getAvatarFilename()),
        comment.getContent(),
        comment.getCreatedAt(),
        comment.getUpdatedAt(),
        comment.getUpvotes(),
        comment.getDownvotes(),
        myVote,
        parent == null ? null : parent.getId(),
        comment.isDeleted(),
        replies);
  }
}
