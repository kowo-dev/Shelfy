package com.shelfy.api.federation;

import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.comments.CommentService;
import com.shelfy.api.comments.dto.CreateCommentRequestDto;
import com.shelfy.api.common.exception.ApiException;
import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.notifications.NotificationType;
import java.net.URI;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

@Component
@RequiredArgsConstructor
public class InboundInteractions {

  static final int MAX_COMMENT_LENGTH = 500;
  private static final Logger LOG = LoggerFactory.getLogger(InboundInteractions.class);

  private final CommentService commentService;
  private final ObjectLookup lookup;
  private final JdbcClient jdbcClient;
  private final NotificationService notificationService;

  public void onReply(UserEntity signer, String signerUri, JsonNode note) {
    String noteId = Activities.idOf(note);
    if (noteId == null
        || !signerUri.equals(Activities.idOf(note.path("attributedTo")))
        || !sameHost(noteId, signerUri)) {
      return;
    }
    String text = commentText(Activities.text(note, "content"));
    if (text == null) {
      return;
    }
    Optional<UUID> existing = lookup.remoteComment(signer.getId(), noteId);
    if (existing.isPresent()) {
      lookup
          .comment(noteId)
          .ifPresent(
              ref ->
                  ignoreRefusal(
                      () ->
                          commentService.update(
                              signer.getId(),
                              ref.targetType(),
                              ref.targetId(),
                              ref.commentId(),
                              new CreateCommentRequestDto(text, null))));
      return;
    }
    String inReplyTo = Activities.idOf(note.path("inReplyTo"));
    if (inReplyTo == null) {
      return;
    }
    Optional<ObjectLookup.CommentRef> parent = lookup.comment(inReplyTo);
    Optional<ObjectLookup.Target> target =
        parent
            .map(ref -> new ObjectLookup.Target(ref.targetType(), ref.targetId(), null))
            .or(() -> lookup.targetOf(inReplyTo));
    if (target.isEmpty()) {
      return;
    }
    ignoreRefusal(
        () -> {
          UUID commentId =
              commentService
                  .create(
                      signer.getId(),
                      target.get().type(),
                      target.get().id(),
                      new CreateCommentRequestDto(
                          text, parent.map(ObjectLookup.CommentRef::commentId).orElse(null)))
                  .id();
          lookup.mapRemoteComment(noteId, commentId, signer.getId());
        });
  }

  public boolean onDelete(UserEntity signer, String objectId) {
    Optional<UUID> commentId = lookup.remoteComment(signer.getId(), objectId);
    if (commentId.isEmpty()) {
      return false;
    }
    lookup
        .comment(objectId)
        .ifPresent(
            ref ->
                ignoreRefusal(
                    () ->
                        commentService.delete(
                            signer.getId(), ref.targetType(), ref.targetId(), ref.commentId())));
    return true;
  }

  public void onLike(UserEntity signer, JsonNode like, boolean liked) {
    Optional<ObjectLookup.Target> target =
        lookup
            .targetOf(Activities.idOf(like.path("object")))
            .filter(found -> !found.ownerId().equals(signer.getId()));
    if (target.isEmpty()) {
      return;
    }
    String table;
    String column;
    switch (target.get().type()) {
      case REVIEW -> {
        table = "review_likes";
        column = "review_id";
      }
      case LIST -> {
        table = "media_list_likes";
        column = "list_id";
      }
      default -> {
        table = "versus_pool_likes";
        column = "pool_id";
      }
    }
    String sql =
        liked
            ? "insert into "
                + table
                + " ("
                + column
                + ", user_id) values (:target, :user) on conflict do nothing"
            : "delete from " + table + " where " + column + " = :target and user_id = :user";
    int changed =
        jdbcClient
            .sql(sql)
            .param("target", target.get().id())
            .param("user", signer.getId())
            .update();
    if (changed == 0) {
      return;
    }
    if (liked) {
      notificationService.create(
          target.get().ownerId(),
          signer.getId(),
          NotificationType.CREATION_LIKED,
          target.get().type().name(),
          target.get().id(),
          Map.of());
    } else {
      notificationService.retract(
          target.get().ownerId(),
          signer.getId(),
          NotificationType.CREATION_LIKED,
          target.get().type().name(),
          target.get().id());
    }
  }

  static String commentText(String html) {
    String text = RemoteActorService.plainText(html);
    if (text == null || text.isBlank()) {
      return null;
    }
    text = text.replaceAll("\\s+", " ").strip();
    return text.length() <= MAX_COMMENT_LENGTH ? text : text.substring(0, MAX_COMMENT_LENGTH);
  }

  private static void ignoreRefusal(Runnable action) {
    try {
      action.run();
    } catch (ApiException e) {
      LOG.info("Remote interaction refused: {}", e.getMessage());
    }
  }

  private static boolean sameHost(String a, String b) {
    try {
      return Objects.equals(URI.create(a).getRawAuthority(), URI.create(b).getRawAuthority());
    } catch (IllegalArgumentException e) {
      return false;
    }
  }
}
