package com.shelfy.api.comments;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.shelfy.api.auth.AvatarStorageService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.comments.dto.CommentVoteRequestDto;
import com.shelfy.api.comments.dto.CreateCommentRequestDto;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ForbiddenException;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.federation.FederationProperties;
import com.shelfy.api.federation.FederationUris;
import com.shelfy.api.federation.InteractionPublisher;
import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.notifications.NotificationType;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class CommentServiceTest {

  private static final CommentTargetType TYPE = CommentTargetType.REVIEW;

  private final CommentRepository commentRepository = mock(CommentRepository.class);
  private final CommentVoteRepository voteRepository = mock(CommentVoteRepository.class);
  private final UserRepository userRepository = mock(UserRepository.class);
  private final NotificationService notificationService = mock(NotificationService.class);
  private final CommentTargetResolver resolver = mock(CommentTargetResolver.class);
  private final CommentService service = newService();

  private final UUID targetId = UUID.randomUUID();
  private final UserEntity author = user("author");

  private CommentService newService() {
    when(resolver.targetType()).thenReturn(TYPE);
    when(commentRepository.save(any(CommentEntity.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));
    return new CommentService(
        commentRepository,
        voteRepository,
        new WilsonScoreCommentScoringStrategy(),
        userRepository,
        notificationService,
        mock(AvatarStorageService.class),
        List.of(resolver),
        mock(InteractionPublisher.class),
        new FederationUris(
            new FederationProperties(
                true, "shelfy.test", "https://api.shelfy.test", null, false, List.of(), false)));
  }

  private static UserEntity user(String username) {
    UserEntity user = new UserEntity(username + "@example.com", username, "hash");
    user.setId(UUID.randomUUID());
    return user;
  }

  private CommentEntity comment(UserEntity owner, UUID onTarget) {
    CommentEntity comment = new CommentEntity(TYPE, onTarget, owner, "hello", null);
    ReflectionTestUtils.setField(comment, "id", UUID.randomUUID());
    return comment;
  }

  @Test
  void create_savesTrimmedContentAndNotifiesTheResolver() {
    when(userRepository.getReferenceById(author.getId())).thenReturn(author);

    var response =
        service.create(author.getId(), TYPE, targetId, new CreateCommentRequestDto("  hi  ", null));

    assertEquals("hi", response.content());
    verify(resolver).onCommentCreated(author.getId(), targetId);
  }

  @Test
  void create_rejectsWhenTargetIsNotVisible() {
    doThrow(new ForbiddenException(ErrorCode.UNAUTHORIZED, "no"))
        .when(resolver)
        .assertVisible(author.getId(), targetId);

    assertThrows(
        ForbiddenException.class,
        () ->
            service.create(
                author.getId(), TYPE, targetId, new CreateCommentRequestDto("hi", null)));

    verify(commentRepository, never()).save(any());
  }

  @Test
  void create_rejectsParentBelongingToAnotherTarget() {
    CommentEntity foreignParent = comment(user("other"), UUID.randomUUID());
    when(commentRepository.findById(foreignParent.getId())).thenReturn(Optional.of(foreignParent));

    ResourceNotFoundException ex =
        assertThrows(
            ResourceNotFoundException.class,
            () ->
                service.create(
                    author.getId(),
                    TYPE,
                    targetId,
                    new CreateCommentRequestDto("reply", foreignParent.getId())));

    assertEquals(ErrorCode.COMMENT_NOT_FOUND, ex.getCode());
    verify(commentRepository, never()).save(any());
  }

  @Test
  void create_notifiesLocalUsersMentionedWithTheirFullHandle() {
    UserEntity mentioned = user("bobby");
    when(userRepository.getReferenceById(author.getId())).thenReturn(author);
    when(userRepository.findByUsernameIgnoreCaseInAndDomainIsNull(Set.of("bobby")))
        .thenReturn(List.of(mentioned));
    when(commentRepository.save(any(CommentEntity.class)))
        .thenAnswer(
            invocation -> {
              CommentEntity saved = invocation.getArgument(0);
              ReflectionTestUtils.setField(saved, "id", UUID.randomUUID());
              return saved;
            });

    service.create(
        author.getId(),
        TYPE,
        targetId,
        new CreateCommentRequestDto("hey @bobby@shelfy.test", null));

    verify(notificationService)
        .create(
            eq(mentioned.getId()),
            eq(author.getId()),
            eq(NotificationType.COMMENT_MENTION),
            eq("COMMENT"),
            any(UUID.class),
            any());
  }

  @Test
  void create_notifiesMentionedUsers() {
    UserEntity mentioned = user("bobby");
    when(userRepository.getReferenceById(author.getId())).thenReturn(author);
    when(userRepository.findByUsernameIgnoreCaseInAndDomainIsNull(Set.of("bobby")))
        .thenReturn(List.of(mentioned));
    when(commentRepository.save(any(CommentEntity.class)))
        .thenAnswer(
            invocation -> {
              CommentEntity saved = invocation.getArgument(0);
              ReflectionTestUtils.setField(saved, "id", UUID.randomUUID());
              return saved;
            });

    service.create(author.getId(), TYPE, targetId, new CreateCommentRequestDto("hey @bobby", null));

    verify(notificationService)
        .create(
            eq(mentioned.getId()),
            eq(author.getId()),
            eq(NotificationType.COMMENT_MENTION),
            eq("COMMENT"),
            any(UUID.class),
            any());
  }

  @Test
  void update_forbidsNonAuthor() {
    CommentEntity existing = comment(author, targetId);
    when(commentRepository.findById(existing.getId())).thenReturn(Optional.of(existing));

    assertThrows(
        ForbiddenException.class,
        () ->
            service.update(
                UUID.randomUUID(),
                TYPE,
                targetId,
                existing.getId(),
                new CreateCommentRequestDto("edited", null)));

    assertEquals("hello", existing.getContent());
  }

  @Test
  void update_letsTheAuthorEdit() {
    CommentEntity existing = comment(author, targetId);
    when(commentRepository.findById(existing.getId())).thenReturn(Optional.of(existing));

    service.update(
        author.getId(),
        TYPE,
        targetId,
        existing.getId(),
        new CreateCommentRequestDto(" edited ", null));

    assertEquals("edited", existing.getContent());
  }

  @Test
  void delete_forbidsStrangerWithoutModerationRights() {
    CommentEntity existing = comment(author, targetId);
    UUID stranger = UUID.randomUUID();
    when(commentRepository.findById(existing.getId())).thenReturn(Optional.of(existing));
    when(resolver.canModerate(targetId, stranger)).thenReturn(false);

    assertThrows(
        ForbiddenException.class, () -> service.delete(stranger, TYPE, targetId, existing.getId()));

    verify(commentRepository, never()).delete(any());
  }

  @Test
  void delete_allowsTargetModerator() {
    CommentEntity existing = comment(author, targetId);
    UUID moderator = UUID.randomUUID();
    when(commentRepository.findById(existing.getId())).thenReturn(Optional.of(existing));
    when(resolver.canModerate(targetId, moderator)).thenReturn(true);

    service.delete(moderator, TYPE, targetId, existing.getId());

    verify(commentRepository).delete(existing);
  }

  @Test
  void delete_rejectsCommentFromAnotherTarget() {
    CommentEntity existing = comment(author, UUID.randomUUID());
    when(commentRepository.findById(existing.getId())).thenReturn(Optional.of(existing));

    assertThrows(
        ResourceNotFoundException.class,
        () -> service.delete(author.getId(), TYPE, targetId, existing.getId()));

    verify(commentRepository, never()).delete(any());
  }

  @Test
  void vote_forbidsVotingOnOwnComment() {
    CommentEntity existing = comment(author, targetId);
    when(commentRepository.findByIdForVote(existing.getId())).thenReturn(Optional.of(existing));

    assertThrows(
        ForbiddenException.class,
        () ->
            service.vote(
                author.getId(), TYPE, targetId, existing.getId(), new CommentVoteRequestDto(1)));

    verify(voteRepository, never()).save(any());
  }

  @Test
  void vote_rejectsValuesOtherThanPlusOrMinusOne() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            service.vote(
                UUID.randomUUID(),
                TYPE,
                targetId,
                UUID.randomUUID(),
                new CommentVoteRequestDto(0)));
  }

  @Test
  void vote_recordsVoteFromAnotherUser() {
    CommentEntity existing = comment(author, targetId);
    UUID voter = UUID.randomUUID();
    when(commentRepository.findByIdForVote(existing.getId())).thenReturn(Optional.of(existing));
    when(voteRepository.findByCommentIdAndUserId(existing.getId(), voter))
        .thenReturn(Optional.empty());
    when(voteRepository.countByCommentIdAndValue(existing.getId(), 1)).thenReturn(1L);

    var response =
        service.vote(voter, TYPE, targetId, existing.getId(), new CommentVoteRequestDto(1));

    verify(voteRepository).save(any(CommentVoteEntity.class));
    assertEquals(1, response.upvotes());
    assertEquals(0, response.downvotes());
  }

  private CommentEntity comment(UserEntity owner, CommentEntity parent, int minutesAgo) {
    CommentEntity comment = new CommentEntity(TYPE, targetId, owner, "hello", parent);
    ReflectionTestUtils.setField(comment, "id", UUID.randomUUID());
    ReflectionTestUtils.setField(
        comment, "createdAt", Instant.now().minus(Duration.ofMinutes(minutesAgo)));
    return comment;
  }

  @Test
  void list_nestsRepliesUnderTheirParentAndPaginatesRoots() {
    CommentEntity older = comment(author, null, 30);
    CommentEntity newer = comment(author, null, 10);
    CommentEntity reply = comment(user("bob"), older, 20);
    CommentEntity nested = comment(author, reply, 5);
    when(commentRepository.findWithAuthorsByTargets(TYPE, List.of(targetId)))
        .thenReturn(List.of(nested, older, reply, newer));

    var page = service.list(author.getId(), TYPE, targetId, -5, 10_000, CommentSortMode.RECENT);

    assertEquals(0, page.page());
    assertEquals(50, page.size());
    assertEquals(2, page.totalElements());
    assertEquals(
        List.of(newer.getId(), older.getId()), page.content().stream().map(c -> c.id()).toList());
    var replyDto = page.content().get(1).replies().getFirst();
    assertEquals(reply.getId(), replyDto.id());
    assertEquals(nested.getId(), replyDto.replies().getFirst().id());
  }

  @Test
  void delete_keepsAPlaceholderWhenTheCommentHasReplies() {
    CommentEntity parent = comment(author, null, 10);
    CommentEntity reply = comment(user("bob"), parent, 5);
    when(commentRepository.findById(parent.getId())).thenReturn(Optional.of(parent));
    when(commentRepository.existsByParentId(parent.getId())).thenReturn(true);

    service.delete(author.getId(), TYPE, targetId, parent.getId());

    verify(commentRepository, never()).delete(any());
    when(commentRepository.findWithAuthorsByTargets(TYPE, List.of(targetId)))
        .thenReturn(List.of(parent, reply));
    var root =
        service.list(null, TYPE, targetId, 0, 10, CommentSortMode.RELEVANCE).content().getFirst();
    assertTrue(root.isDeleted());
    assertEquals("", root.content());
    assertNull(root.authorUsername());
    assertEquals(reply.getId(), root.replies().getFirst().id());
  }

  @Test
  void list_hidesDeletedCommentsWithoutLiveReplies() {
    CommentEntity deleted = comment(author, null, 10);
    deleted.markDeleted();
    when(commentRepository.findWithAuthorsByTargets(TYPE, List.of(targetId)))
        .thenReturn(List.of(deleted));

    var page = service.list(null, TYPE, targetId, 0, 10, CommentSortMode.RELEVANCE);

    assertEquals(0, page.totalElements());
  }

  @Test
  void update_rejectsDeletedComment() {
    CommentEntity deleted = comment(author, null, 10);
    deleted.markDeleted();
    when(commentRepository.findById(deleted.getId())).thenReturn(Optional.of(deleted));

    assertThrows(
        ResourceNotFoundException.class,
        () ->
            service.update(
                author.getId(),
                TYPE,
                targetId,
                deleted.getId(),
                new CreateCommentRequestDto("back", null)));
  }

  @Test
  void rejectsTargetTypesWithoutResolver() {
    assertThrows(
        IllegalStateException.class,
        () ->
            service.list(
                author.getId(), CommentTargetType.LIST, targetId, 0, 10, CommentSortMode.RECENT));
  }
}
