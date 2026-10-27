package com.shelfy.api.federation;

import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ProfilePublisher {

  private final FederationProperties properties;
  private final FederationUris uris;
  private final JdbcClient jdbcClient;
  private final DeliveryService deliveryService;
  private final ActorDocuments documents;
  private final ActorStore actorStore;
  private final UserRepository userRepository;

  public void updated(UUID userId) {
    if (!properties.enabled()) {
      return;
    }
    UserEntity user =
        userRepository.findById(userId).filter(found -> found.getDomain() == null).orElse(null);
    if (user == null) {
      return;
    }
    List<String> inboxes = relatedInboxes(userId);
    if (inboxes.isEmpty()) {
      return;
    }
    Map<String, Object> person = new LinkedHashMap<>(documents.person(user));
    person.remove("@context");
    Map<String, Object> update = new LinkedHashMap<>();
    update.put("@context", ActorDocuments.CONTEXT);
    update.put("id", uris.actor(userId) + "#updates/" + System.currentTimeMillis());
    update.put("type", "Update");
    update.put("actor", uris.actor(userId));
    update.put("to", List.of(ActivityPublisher.PUBLIC));
    update.put("object", person);
    inboxes.forEach(inbox -> deliveryService.enqueue(userId, inbox, update));
  }

  public void deleting(UUID userId) {
    if (!properties.enabled()) {
      return;
    }
    boolean local =
        userRepository.findById(userId).map(user -> user.getDomain() == null).orElse(false);
    List<String> inboxes = relatedInboxes(userId);
    if (!local || inboxes.isEmpty()) {
      return;
    }
    ActorStore.KeyPem key = actorStore.localKey(userId);
    String actor = uris.actor(userId);
    Map<String, Object> delete = new LinkedHashMap<>();
    delete.put("@context", ActorDocuments.ACTIVITY_STREAMS);
    delete.put("id", actor + "#delete");
    delete.put("type", "Delete");
    delete.put("actor", actor);
    delete.put("to", List.of(ActivityPublisher.PUBLIC));
    delete.put("object", actor);
    inboxes.forEach(inbox -> deliveryService.enqueueSignedBy(key, inbox, delete));
  }

  public void moved(UUID userId, String targetUri) {
    if (!properties.enabled()) {
      return;
    }
    List<String> inboxes = relatedInboxes(userId);
    String actor = uris.actor(userId);
    Map<String, Object> move = new LinkedHashMap<>();
    move.put("@context", ActorDocuments.ACTIVITY_STREAMS);
    move.put("id", actor + "#moves/" + System.currentTimeMillis());
    move.put("type", "Move");
    move.put("actor", actor);
    move.put("object", actor);
    move.put("target", targetUri);
    move.put("to", List.of(uris.followers(userId)));
    inboxes.forEach(inbox -> deliveryService.enqueue(userId, inbox, move));
    updated(userId);
  }

  private List<String> relatedInboxes(UUID userId) {
    return jdbcClient
        .sql(
            """
            select distinct coalesce(a.shared_inbox, a.inbox) from ap_actors a
            where a.actor_uri is not null and a.user_id in (
              select follower_id from follows where followed_id = :id
              union select followed_id from follows where follower_id = :id
              union select followed_id from ap_follow_requests where follower_id = :id)
            """)
        .param("id", userId)
        .query(String.class)
        .list();
  }
}
