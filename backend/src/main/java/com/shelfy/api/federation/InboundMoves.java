package com.shelfy.api.federation;

import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.notifications.NotificationType;
import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Component
@RequiredArgsConstructor
public class InboundMoves {

  private static final Logger LOG = LoggerFactory.getLogger(InboundMoves.class);

  private final RemoteActorService remoteActors;
  private final RemoteFetcher fetcher;
  private final FederatedFollows follows;
  private final UserRepository userRepository;
  private final JdbcClient jdbcClient;
  private final FederationUris uris;
  private final NotificationService notificationService;

  @Transactional
  public void onMove(UserEntity signer, String signerUri, JsonNode activity) {
    String targetUri = Activities.idOf(activity.path("target"));
    if (targetUri == null
        || !signerUri.equals(Activities.idOf(activity.path("object")))
        || targetUri.equals(signerUri)) {
      return;
    }
    Optional<UserEntity> target = confirmedTarget(signerUri, targetUri);
    if (target.isEmpty()) {
      return;
    }
    List<UUID> followers =
        jdbcClient
            .sql(
                """
                select f.follower_id from follows f join users u on u.id = f.follower_id
                where f.followed_id = :old and u.domain is null
                """)
            .param("old", signer.getId())
            .query(UUID.class)
            .list();
    Map<String, Object> from = new HashMap<>();
    from.put("fromUsername", signer.getUsername());
    from.put("fromDomain", signer.getDomain());
    for (UUID follower : followers) {
      follow(follower, target.get());
      follows.cancel(follower, signer);
      notificationService.create(
          follower, target.get().getId(), NotificationType.ACCOUNT_MOVED, null, null, from);
    }
  }

  private Optional<UserEntity> confirmedTarget(String oldUri, String targetUri) {
    try {
      if (uris.isLocalUri(targetUri)) {
        return uris.localUserId(targetUri)
            .flatMap(userRepository::findById)
            .filter(user -> user.getDomain() == null)
            .filter(user -> oldUri.equals(user.getAlsoKnownAs()));
      }
      JsonNode doc = fetcher.fetchActivity(URI.create(targetUri));
      if (!AccountMigration.aliases(doc).contains(oldUri)) {
        return Optional.empty();
      }
      return Optional.of(remoteActors.resolveActor(targetUri, false));
    } catch (RemoteFetcher.RemoteFetchException e) {
      LOG.info("Ignored a move to {}: {}", targetUri, e.getMessage());
      return Optional.empty();
    }
  }

  private void follow(UUID follower, UserEntity target) {
    if (target.getDomain() != null) {
      follows.request(follower, target);
      return;
    }
    jdbcClient
        .sql(
            """
            insert into follows (follower_id, followed_id) values (:follower, :followed)
            on conflict do nothing
            """)
        .param("follower", follower)
        .param("followed", target.getId())
        .update();
  }
}
