package com.shelfy.api.federation;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.follows.FollowRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ConditionalOnBooleanProperty("app.federation.enabled")
@RequiredArgsConstructor
public class ActorController {

  private static final int OUTBOX_PAGE_SIZE = 20;

  private final UserRepository userRepository;
  private final FollowRepository followRepository;
  private final ActorDocuments documents;
  private final FederationUris uris;
  private final ActivityPublisher publisher;
  private final InteractionPublisher interactionPublisher;
  private final CollectionPublisher collectionPublisher;

  @GetMapping("/ap/lists/{id}")
  public ResponseEntity<Map<String, Object>> list(@PathVariable UUID id) {
    return collectionPublisher
        .listDocument(id)
        .map(note -> ResponseEntity.ok().contentType(ActorDocuments.ACTIVITY_JSON).body(note))
        .orElseGet(() -> ResponseEntity.notFound().build());
  }

  @GetMapping("/ap/versus/{id}")
  public ResponseEntity<Map<String, Object>> getPool(@PathVariable UUID id) {
    return collectionPublisher
        .poolDocument(id)
        .map(note -> ResponseEntity.ok().contentType(ActorDocuments.ACTIVITY_JSON).body(note))
        .orElseGet(() -> ResponseEntity.notFound().build());
  }

  @GetMapping("/ap/comments/{id}")
  public ResponseEntity<Map<String, Object>> getComment(@PathVariable UUID id) {
    return interactionPublisher
        .commentDocument(id)
        .map(note -> ResponseEntity.ok().contentType(ActorDocuments.ACTIVITY_JSON).body(note))
        .orElseGet(() -> ResponseEntity.notFound().build());
  }

  @GetMapping("/ap/actor")
  public ResponseEntity<Map<String, Object>> getInstance() {
    return ResponseEntity.ok().contentType(ActorDocuments.ACTIVITY_JSON).body(documents.instance());
  }

  @GetMapping("/ap/users/{id}")
  public ResponseEntity<Map<String, Object>> getPerson(@PathVariable UUID id) {
    return respond(id, documents::person);
  }

  @GetMapping("/ap/users/{id}/followers")
  public ResponseEntity<Map<String, Object>> getFollowers(@PathVariable UUID id) {
    return respond(
        id,
        user -> collection(uris.followers(id), followRepository.countByFollowedId(user.getId())));
  }

  @GetMapping("/ap/users/{id}/following")
  public ResponseEntity<Map<String, Object>> getFollowing(@PathVariable UUID id) {
    return respond(
        id,
        user -> collection(uris.following(id), followRepository.countByFollowerId(user.getId())));
  }

  @GetMapping("/ap/users/{id}/outbox")
  public ResponseEntity<Map<String, Object>> getOutbox(@PathVariable UUID id) {
    return respond(id, user -> publisher.outbox(id, OUTBOX_PAGE_SIZE));
  }

  @GetMapping("/ap/activities/{id}")
  public ResponseEntity<Map<String, Object>> getActivity(@PathVariable UUID id) {
    return publisher
        .noteDocument(id)
        .map(note -> ResponseEntity.ok().contentType(ActorDocuments.ACTIVITY_JSON).body(note))
        .orElseGet(() -> ResponseEntity.notFound().build());
  }

  private ResponseEntity<Map<String, Object>> respond(
      UUID id, Function<UserEntity, Map<String, Object>> body) {
    Optional<UserEntity> user =
        userRepository
            .findById(id)
            .filter(found -> found.getDomain() == null)
            .filter(found -> found.federatedVisibility() != CollectionVisibility.PRIVATE);
    return user.map(
            found ->
                ResponseEntity.ok()
                    .contentType(ActorDocuments.ACTIVITY_JSON)
                    .body(body.apply(found)))
        .orElseGet(() -> ResponseEntity.notFound().build());
  }

  private static Map<String, Object> collection(String id, long total) {
    Map<String, Object> doc = new LinkedHashMap<>();
    doc.put("@context", ActorDocuments.ACTIVITY_STREAMS);
    doc.put("id", id);
    doc.put("type", "OrderedCollection");
    doc.put("totalItems", total);
    doc.put("orderedItems", List.of());
    return doc;
  }
}
