package com.shelfy.api.federation;

import com.shelfy.api.activity.UserActivityEntity;
import com.shelfy.api.activity.UserActivityRepository;
import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.notifications.NotificationType;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Component
@RequiredArgsConstructor
public class FederatedFollows {

  static final int BACKFILL_SIZE = 5;
  static final Duration BACKFILL_DELAY = Duration.ofSeconds(30);

  private final JdbcClient jdbcClient;
  private final UserRepository userRepository;
  private final ActorStore actorStore;
  private final DeliveryService deliveryService;
  private final FederationUris uris;
  private final UserActivityRepository activityRepository;
  private final ActivityPublisher activityPublisher;
  private final NotificationService notificationService;

  public boolean isPending(UUID followerId, UUID followedId) {
    return jdbcClient
        .sql(
            """
            select exists (select 1 from ap_follow_requests
                           where follower_id = :follower and followed_id = :followed)
            """)
        .param("follower", followerId)
        .param("followed", followedId)
        .query(Boolean.class)
        .single();
  }

  @Transactional
  public void request(UUID followerId, UserEntity remote) {
    ActorStore.RemoteActor target = remoteActor(remote.getId());
    String followId = uris.actor(followerId) + "/follows/" + UUID.randomUUID();
    int inserted =
        jdbcClient
            .sql(
                """
                insert into ap_follow_requests (follower_id, followed_id, ap_id)
                values (:follower, :followed, :apId) on conflict do nothing
                """)
            .param("follower", followerId)
            .param("followed", remote.getId())
            .param("apId", followId)
            .update();
    if (inserted == 1) {
      deliveryService.enqueue(
          followerId,
          target.inbox(),
          Activities.follow(followId, uris.actor(followerId), target.actorUri()));
    }
  }

  @Transactional
  public void cancel(UUID followerId, UserEntity remote) {
    ActorStore.RemoteActor target = remoteActor(remote.getId());
    Optional<String> followId =
        jdbcClient
            .sql(
                """
                delete from ap_follow_requests
                where follower_id = :follower and followed_id = :followed returning ap_id
                """)
            .param("follower", followerId)
            .param("followed", remote.getId())
            .query(String.class)
            .optional()
            .or(
                () ->
                    jdbcClient
                        .sql(
                            """
                            delete from follows
                            where follower_id = :follower and followed_id = :followed
                            returning coalesce(ap_id, '')
                            """)
                        .param("follower", followerId)
                        .param("followed", remote.getId())
                        .query(String.class)
                        .optional());
    if (followId.isEmpty()) {
      return;
    }
    String id =
        followId.get().isEmpty()
            ? uris.actor(followerId) + "/follows/" + UUID.randomUUID()
            : followId.get();
    String actor = uris.actor(followerId);
    deliveryService.enqueue(
        followerId,
        target.inbox(),
        Activities.undo(id + "#undo", actor, Activities.follow(id, actor, target.actorUri())));
  }

  @Transactional
  public void onFollow(UserEntity remote, String remoteActorUri, JsonNode activity) {
    String followId = Activities.idOf(activity);
    Optional<UserEntity> local =
        uris.localUserId(Activities.idOf(activity.path("object")))
            .flatMap(userRepository::findById)
            .filter(user -> user.getDomain() == null);
    if (local.isEmpty()) {
      return;
    }
    UserEntity followed = local.get();
    Map<String, Object> follow =
        Activities.follow(followId, remoteActorUri, uris.actor(followed.getId()));
    String responseId = uris.actor(followed.getId()) + "#responses/" + UUID.randomUUID();
    String inbox = remoteActor(remote.getId()).inbox();
    if (followed.federatedVisibility() == CollectionVisibility.PRIVATE) {
      deliveryService.enqueue(
          followed.getId(),
          inbox,
          Activities.respond("Reject", responseId, uris.actor(followed.getId()), follow));
      return;
    }
    boolean inserted =
        jdbcClient
            .sql(
                """
                insert into follows (follower_id, followed_id, ap_id)
                values (:follower, :followed, :apId)
                on conflict (follower_id, followed_id) do update set ap_id = excluded.ap_id
                returning (xmax = 0)
                """)
            .param("follower", remote.getId())
            .param("followed", followed.getId())
            .param("apId", followId)
            .query(Boolean.class)
            .single();
    if (inserted) {
      notificationService.create(
          followed.getId(), remote.getId(), NotificationType.NEW_FOLLOWER, null, null, Map.of());
    }
    deliveryService.enqueue(
        followed.getId(),
        inbox,
        Activities.respond("Accept", responseId, uris.actor(followed.getId()), follow));
    backfill(followed, inbox);
  }

  private void backfill(UserEntity followed, String inbox) {
    if (followed.federatedVisibility() != CollectionVisibility.PUBLIC) {
      return;
    }
    List<UserActivityEntity> recent =
        activityRepository.findByUserIdAndActivityTypeInOrderByCreatedAtDesc(
            followed.getId(), ActivityPublisher.FEDERATED, PageRequest.of(0, BACKFILL_SIZE));
    for (UserActivityEntity activity : recent.reversed()) {
      if (activityPublisher.isPublic(activity)) {
        deliveryService.enqueueAfter(
            followed.getId(), inbox, activityPublisher.create(activity), BACKFILL_DELAY);
      }
    }
  }

  @Transactional
  public void onAccept(UserEntity remote, JsonNode activity) {
    findOwnRequest(remote, activity.path("object"))
        .ifPresent(
            request -> {
              jdbcClient
                  .sql(
                      """
                      delete from ap_follow_requests
                      where follower_id = :follower and followed_id = :followed
                      """)
                  .param("follower", request.followerId())
                  .param("followed", remote.getId())
                  .update();
              jdbcClient
                  .sql(
                      """
                      insert into follows (follower_id, followed_id, ap_id)
                      values (:follower, :followed, :apId)
                      on conflict (follower_id, followed_id) do update set ap_id = excluded.ap_id
                      """)
                  .param("follower", request.followerId())
                  .param("followed", remote.getId())
                  .param("apId", request.apId())
                  .update();
              notificationService.create(
                  request.followerId(),
                  remote.getId(),
                  NotificationType.REMOTE_FOLLOW_ACCEPTED,
                  null,
                  null,
                  Map.of());
            });
  }

  @Transactional
  public void onReject(UserEntity remote, JsonNode activity) {
    Optional<PendingRequest> pending = findOwnRequest(remote, activity.path("object"));
    UUID follower =
        pending
            .map(PendingRequest::followerId)
            .or(
                () ->
                    uris.localUserId(Activities.text(activity.path("object"), "actor"))
                        .or(() -> followerByApId(remote, Activities.idOf(activity.path("object")))))
            .orElse(null);
    if (follower == null) {
      return;
    }
    for (String table : new String[] {"ap_follow_requests", "follows"}) {
      jdbcClient
          .sql(
              "delete from " + table + " where follower_id = :follower and followed_id = :followed")
          .param("follower", follower)
          .param("followed", remote.getId())
          .update();
    }
    if (pending.isPresent()) {
      notificationService.create(
          follower, remote.getId(), NotificationType.REMOTE_FOLLOW_REJECTED, null, null, Map.of());
    }
  }

  @Transactional
  public void onUndoFollow(UserEntity remote, JsonNode follow) {
    String followId = Activities.idOf(follow);
    Optional<UUID> followed = uris.localUserId(Activities.idOf(follow.path("object")));
    jdbcClient
        .sql(
            """
            delete from follows where follower_id = :follower
              and (ap_id = :apId or followed_id = :followed)
            returning followed_id
            """)
        .param("follower", remote.getId())
        .param("apId", followId)
        .param("followed", followed.orElse(new UUID(0, 0)))
        .query(UUID.class)
        .list()
        .forEach(
            unfollowed ->
                notificationService.retract(
                    unfollowed, remote.getId(), NotificationType.NEW_FOLLOWER, null, null));
  }

  record PendingRequest(UUID followerId, String apId) {}

  private Optional<PendingRequest> findOwnRequest(UserEntity remote, JsonNode follow) {
    Optional<PendingRequest> byId =
        jdbcClient
            .sql(
                """
                select follower_id, ap_id from ap_follow_requests
                where ap_id = :apId and followed_id = :followed
                """)
            .param("apId", String.valueOf(Activities.idOf(follow)))
            .param("followed", remote.getId())
            .query(PendingRequest.class)
            .optional();
    if (byId.isPresent()) {
      return byId;
    }
    return uris.localUserId(Activities.text(follow, "actor"))
        .flatMap(
            follower ->
                jdbcClient
                    .sql(
                        """
                        select follower_id, ap_id from ap_follow_requests
                        where follower_id = :follower and followed_id = :followed
                        """)
                    .param("follower", follower)
                    .param("followed", remote.getId())
                    .query(PendingRequest.class)
                    .optional());
  }

  private Optional<UUID> followerByApId(UserEntity remote, String apId) {
    return jdbcClient
        .sql(
            """
            select follower_id from follows where ap_id = :apId and followed_id = :followed
            union select follower_id from ap_follow_requests
            where ap_id = :apId and followed_id = :followed
            """)
        .param("apId", String.valueOf(apId))
        .param("followed", remote.getId())
        .query(UUID.class)
        .optional();
  }

  private ActorStore.RemoteActor remoteActor(UUID userId) {
    return actorStore
        .findRemoteByUserId(userId)
        .orElseThrow(() -> new IllegalStateException("Remote user without actor " + userId));
  }
}
