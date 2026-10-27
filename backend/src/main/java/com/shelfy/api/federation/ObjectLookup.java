package com.shelfy.api.federation;

import com.shelfy.api.collection.UserMediaEntity;
import com.shelfy.api.collection.UserMediaRepository;
import com.shelfy.api.comments.CommentTargetType;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ObjectLookup {

  public record CommentRef(UUID commentId, CommentTargetType targetType, UUID targetId) {}

  public record Target(CommentTargetType type, UUID id, UUID ownerId) {}

  private final JdbcClient jdbcClient;
  private final FederationUris uris;
  private final UserMediaRepository userMediaRepository;

  public Optional<UserMediaEntity> userMedia(String uri) {
    return uris.localActivityId(uri)
        .or(
            () ->
                jdbcClient
                    .sql("select activity_id from ap_remote_activities where ap_id = :apId")
                    .param("apId", uri)
                    .query(UUID.class)
                    .optional())
        .flatMap(
            activityId ->
                jdbcClient
                    .sql("select user_media_id from user_activity where id = :id")
                    .param("id", activityId)
                    .query(UUID.class)
                    .optional())
        .flatMap(userMediaRepository::findById);
  }

  public Optional<CommentRef> comment(String uri) {
    Optional<UUID> commentId =
        uris.localCommentId(uri)
            .or(
                () ->
                    jdbcClient
                        .sql("select comment_id from ap_remote_comments where ap_id = :apId")
                        .param("apId", uri)
                        .query(UUID.class)
                        .optional());
    return commentId.flatMap(
        id ->
            jdbcClient
                .sql("select target_type, target_id from comments where id = :id")
                .param("id", id)
                .query(
                    (rs, row) ->
                        new CommentRef(
                            id,
                            CommentTargetType.valueOf(rs.getString("target_type")),
                            rs.getObject("target_id", UUID.class)))
                .optional());
  }

  public Optional<Target> target(CommentTargetType type, UUID id) {
    String table =
        switch (type) {
          case REVIEW -> "user_media";
          case LIST -> "media_lists";
          case VERSUS_POOL -> "versus_pools";
        };
    return jdbcClient
        .sql("select user_id from " + table + " where id = :id")
        .param("id", id)
        .query(UUID.class)
        .optional()
        .map(owner -> new Target(type, id, owner));
  }

  public Optional<Target> targetOf(String uri) {
    if (uri == null) {
      return Optional.empty();
    }
    Optional<Target> collection =
        uris.localListId(uri)
            .flatMap(id -> target(CommentTargetType.LIST, id))
            .or(
                () ->
                    uris.localPoolId(uri).flatMap(id -> target(CommentTargetType.VERSUS_POOL, id)))
            .or(
                () ->
                    jdbcClient
                        .sql("select kind, local_id from ap_remote_collections where ap_id = :apId")
                        .param("apId", uri)
                        .query(
                            (rs, row) ->
                                target(
                                    "LIST".equals(rs.getString("kind"))
                                        ? CommentTargetType.LIST
                                        : CommentTargetType.VERSUS_POOL,
                                    rs.getObject("local_id", UUID.class)))
                        .optional()
                        .flatMap(found -> found));
    if (collection.isPresent()) {
      return collection;
    }
    return userMedia(uri)
        .map(item -> new Target(CommentTargetType.REVIEW, item.getId(), item.getUserId()));
  }

  public Optional<String> targetUri(Target target, boolean ownerIsRemote) {
    if (target.type() == CommentTargetType.REVIEW) {
      return ownerIsRemote ? remoteNoteFor(target.id()) : localNoteFor(target.id());
    }
    if (ownerIsRemote) {
      return jdbcClient
          .sql("select ap_id from ap_remote_collections where local_id = :id")
          .param("id", target.id())
          .query(String.class)
          .optional();
    }
    boolean published =
        jdbcClient
            .sql("select exists (select 1 from ap_published_objects where object_id = :id)")
            .param("id", target.id())
            .query(Boolean.class)
            .single();
    if (!published) {
      return Optional.empty();
    }
    return Optional.of(
        target.type() == CommentTargetType.LIST ? uris.list(target.id()) : uris.pool(target.id()));
  }

  public Optional<String> remoteNoteFor(UUID userMediaId) {
    return jdbcClient
        .sql(
            """
            select r.ap_id from ap_remote_activities r
            join user_activity a on a.id = r.activity_id
            where a.user_media_id = :id
            order by (a.activity_type = 'REVIEWED') desc, a.created_at desc limit 1
            """)
        .param("id", userMediaId)
        .query(String.class)
        .optional();
  }

  public Optional<String> localNoteFor(UUID userMediaId) {
    return jdbcClient
        .sql(
            """
            select id from user_activity where user_media_id = :id
              and activity_type in ('ADDED', 'REVIEWED', 'RATED', 'STATUS_CHANGED')
            order by (activity_type = 'REVIEWED') desc, created_at desc limit 1
            """)
        .param("id", userMediaId)
        .query(UUID.class)
        .optional()
        .map(uris::activity);
  }

  public String commentUri(UUID commentId) {
    return jdbcClient
        .sql("select ap_id from ap_remote_comments where comment_id = :id")
        .param("id", commentId)
        .query(String.class)
        .optional()
        .orElseGet(() -> uris.comment(commentId));
  }

  public Optional<UUID> remoteComment(UUID authorId, String apId) {
    return jdbcClient
        .sql("select comment_id from ap_remote_comments where ap_id = :apId and user_id = :userId")
        .param("apId", apId)
        .param("userId", authorId)
        .query(UUID.class)
        .optional();
  }

  public void mapRemoteComment(String apId, UUID commentId, UUID authorId) {
    jdbcClient
        .sql(
            """
            insert into ap_remote_comments (ap_id, comment_id, user_id)
            values (:apId, :commentId, :userId) on conflict do nothing
            """)
        .param("apId", apId)
        .param("commentId", commentId)
        .param("userId", authorId)
        .update();
  }

  public boolean hasLocalAudience(UUID remoteUserId) {
    return jdbcClient
        .sql(
            """
            select exists (select 1 from follows f join users u on u.id = f.follower_id
                           where f.followed_id = :remote and u.domain is null)
            """)
        .param("remote", remoteUserId)
        .query(Boolean.class)
        .single();
  }
}
