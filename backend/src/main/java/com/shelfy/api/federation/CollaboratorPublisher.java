package com.shelfy.api.federation;

import com.shelfy.api.comments.CommentTargetType;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CollaboratorPublisher {

  private final FederationProperties properties;
  private final FederationUris uris;
  private final ActorStore actorStore;
  private final ObjectLookup lookup;
  private final DeliveryService deliveryService;

  public void invited(UUID ownerId, UUID inviteeId, Map<String, Object> snapshot) {
    Optional<ActorStore.RemoteActor> invitee = remote(inviteeId);
    if (invitee.isEmpty()) {
      return;
    }
    Map<String, Object> target = new LinkedHashMap<>(snapshot);
    target.put("to", List.of(invitee.get().actorUri()));
    Map<String, Object> invite =
        invite(uris.actor(ownerId), invitee.get().actorUri(), String.valueOf(snapshot.get("id")));
    invite.put("target", target);
    deliveryService.enqueue(ownerId, invitee.get().inbox(), withContext(invite));
  }

  public void removedByOwner(
      CommentTargetType type, UUID collectionId, UUID ownerId, UUID collaboratorId) {
    Optional<ActorStore.RemoteActor> collaborator = remote(collaboratorId);
    if (collaborator.isEmpty()) {
      return;
    }
    Map<String, Object> invite =
        invite(uris.actor(ownerId), collaborator.get().actorUri(), localUri(type, collectionId));
    Map<String, Object> undo = activity("Undo", invite.get("id") + "/undo", ownerId);
    undo.put("object", invite);
    deliveryService.enqueue(ownerId, collaborator.get().inbox(), undo);
  }

  public void answered(
      CommentTargetType type, UUID collectionId, UUID ownerId, UUID localUserId, boolean accepted) {
    Optional<ActorStore.RemoteActor> owner = remote(ownerId);
    Optional<String> target =
        lookup.targetUri(new ObjectLookup.Target(type, collectionId, ownerId), true);
    if (owner.isEmpty() || target.isEmpty()) {
      return;
    }
    Map<String, Object> invite =
        invite(owner.get().actorUri(), uris.actor(localUserId), target.get());
    Map<String, Object> answer =
        activity(
            accepted ? "Accept" : "Reject",
            uris.actor(localUserId) + "#invites/" + UUID.randomUUID(),
            localUserId);
    answer.put("object", invite);
    deliveryService.enqueue(localUserId, owner.get().inbox(), answer);
  }

  public void edited(
      CommentTargetType type,
      UUID collectionId,
      UUID ownerId,
      UUID editorId,
      String field,
      Map<String, Object> state) {
    if (!properties.enabled() || editorId == null || editorId.equals(ownerId)) {
      return;
    }
    Optional<ActorStore.RemoteActor> owner = remote(ownerId);
    Optional<String> target =
        lookup.targetUri(new ObjectLookup.Target(type, collectionId, ownerId), true);
    if (owner.isEmpty() || target.isEmpty()) {
      return;
    }
    Map<String, Object> object = new LinkedHashMap<>();
    object.put("id", target.get());
    object.put("type", "Note");
    object.put(field, state);
    Map<String, Object> update =
        activity("Update", uris.actor(editorId) + "#edits/" + UUID.randomUUID(), editorId);
    update.put("to", List.of(owner.get().actorUri()));
    update.put("object", object);
    deliveryService.enqueue(editorId, owner.get().inbox(), withContext(update));
  }

  private Map<String, Object> invite(String actor, String object, String target) {
    Map<String, Object> invite = new LinkedHashMap<>();
    invite.put("id", actor + "/invites/" + Math.abs((object + target).hashCode()));
    invite.put("type", "Invite");
    invite.put("actor", actor);
    invite.put("object", object);
    invite.put("target", target);
    return invite;
  }

  private Map<String, Object> activity(String type, String id, UUID actorId) {
    Map<String, Object> activity = new LinkedHashMap<>();
    activity.put("@context", ActorDocuments.CONTEXT);
    activity.put("id", id);
    activity.put("type", type);
    activity.put("actor", uris.actor(actorId));
    return activity;
  }

  private static Map<String, Object> withContext(Map<String, Object> activity) {
    Map<String, Object> copy = new LinkedHashMap<>();
    copy.put("@context", ActorDocuments.CONTEXT);
    copy.putAll(activity);
    return copy;
  }

  private String localUri(CommentTargetType type, UUID id) {
    return type == CommentTargetType.LIST ? uris.list(id) : uris.pool(id);
  }

  private Optional<ActorStore.RemoteActor> remote(UUID userId) {
    return properties.enabled() ? actorStore.findRemoteByUserId(userId) : Optional.empty();
  }
}
