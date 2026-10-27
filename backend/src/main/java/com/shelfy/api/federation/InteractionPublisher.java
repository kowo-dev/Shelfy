package com.shelfy.api.federation;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.collection.UserMediaEntity;
import com.shelfy.api.collection.UserMediaRepository;
import com.shelfy.api.comments.CommentEntity;
import com.shelfy.api.comments.CommentRepository;
import com.shelfy.api.comments.CommentTargetType;
import com.shelfy.api.comments.MentionParser;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

@Component
@RequiredArgsConstructor
public class InteractionPublisher {

  private final FederationProperties properties;
  private final FederationUris uris;
  private final UserRepository userRepository;
  private final UserMediaRepository userMediaRepository;
  private final ActorStore actorStore;
  private final ObjectLookup lookup;
  private final RemoteActorService remoteActors;
  private final DeliveryService deliveryService;
  private final CommentRepository commentRepository;

  public void commentCreated(CommentEntity comment) {
    publishComment(comment, "Create", uris.comment(comment.getId()) + "/create");
  }

  public void commentUpdated(CommentEntity comment) {
    publishComment(
        comment, "Update", uris.comment(comment.getId()) + "/update/" + System.currentTimeMillis());
  }

  public void commentDeleted(CommentEntity comment) {
    Optional<Recipients> recipients = recipients(comment);
    if (recipients.isEmpty()) {
      return;
    }
    String id = uris.comment(comment.getId());
    Map<String, Object> delete = activity("Delete", id + "/delete", comment.getAuthor().getId());
    delete.put("object", Map.of("id", id, "type", "Tombstone"));
    deliver(comment.getAuthor().getId(), recipients.get().inboxes(), delete);
  }

  public void reviewLiked(UUID likerId, UserMediaEntity review, boolean liked) {
    liked(
        likerId,
        new ObjectLookup.Target(CommentTargetType.REVIEW, review.getId(), review.getUserId()),
        liked);
  }

  public void collectionLiked(
      UUID likerId, CommentTargetType type, UUID id, UUID ownerId, boolean liked) {
    liked(likerId, new ObjectLookup.Target(type, id, ownerId), liked);
  }

  private void liked(UUID likerId, ObjectLookup.Target target, boolean liked) {
    if (!properties.enabled() || !isFederatingLocal(likerId)) {
      return;
    }
    Optional<ActorStore.RemoteActor> owner = actorStore.findRemoteByUserId(target.ownerId());
    Optional<String> note = owner.isEmpty() ? Optional.empty() : lookup.targetUri(target, true);
    if (owner.isEmpty() || note.isEmpty()) {
      return;
    }
    String likeId = uris.actor(likerId) + "/likes/" + target.id();
    Map<String, Object> like = activity("Like", likeId, likerId);
    like.put("object", note.get());
    if (liked) {
      deliver(likerId, List.of(owner.get().inbox()), like);
      return;
    }
    Map<String, Object> undo = activity("Undo", likeId + "/undo", likerId);
    like.remove("@context");
    undo.put("object", like);
    deliver(likerId, List.of(owner.get().inbox()), undo);
  }

  @Transactional(readOnly = true)
  public Optional<Map<String, Object>> commentDocument(UUID commentId) {
    Optional<CommentEntity> comment =
        commentRepository
            .findById(commentId)
            .filter(found -> !found.isDeleted() && found.getAuthor().getDomain() == null);
    if (comment.isEmpty() || !properties.enabled()) {
      return Optional.empty();
    }
    return recipientsOrPublic(comment.get())
        .map(
            recipients -> {
              Map<String, Object> note = new LinkedHashMap<>();
              note.put("@context", ActorDocuments.CONTEXT);
              note.putAll(note(comment.get(), recipients));
              return note;
            });
  }

  record Recipients(
      String inReplyTo,
      List<String> inboxes,
      List<String> actors,
      List<Map<String, Object>> tags) {}

  private void publishComment(CommentEntity comment, String type, String id) {
    Optional<Recipients> recipients = recipients(comment);
    if (recipients.isEmpty() || recipients.get().inboxes().isEmpty()) {
      return;
    }
    Map<String, Object> activity = activity(type, id, comment.getAuthor().getId());
    Map<String, Object> note = note(comment, recipients.get());
    activity.put("to", note.get("to"));
    activity.put("cc", note.get("cc"));
    activity.put("object", note);
    deliver(comment.getAuthor().getId(), recipients.get().inboxes(), activity);
  }

  private Optional<Recipients> recipients(CommentEntity comment) {
    if (!properties.enabled() || !isFederatingLocal(comment.getAuthor().getId())) {
      return Optional.empty();
    }
    return recipientsOrPublic(comment);
  }

  private Optional<Recipients> recipientsOrPublic(CommentEntity comment) {
    Optional<ObjectLookup.Target> target =
        lookup.target(comment.getTargetType(), comment.getTargetId());
    if (target.isEmpty()) {
      return Optional.empty();
    }
    Set<UUID> remoteUsers = new LinkedHashSet<>();
    UUID ownerId = target.get().ownerId();
    Optional<UserEntity> owner = userRepository.findById(ownerId);
    if (owner.isEmpty() || owner.get().federatedVisibility() != CollectionVisibility.PUBLIC) {
      return Optional.empty();
    }
    if (owner.get().getDomain() != null) {
      remoteUsers.add(ownerId);
    }
    if (comment.getParent() != null && comment.getParent().getAuthor().getDomain() != null) {
      remoteUsers.add(comment.getParent().getAuthor().getId());
    }
    List<Map<String, Object>> tags = new ArrayList<>();
    for (String handle : MentionParser.extractRemoteHandles(comment.getContent())) {
      userRepository
          .findByUsernameIgnoreCase(handle)
          .or(() -> remoteActors.tryResolveHandle(handle))
          .filter(user -> user.getDomain() != null)
          .ifPresent(
              user -> {
                remoteUsers.add(user.getId());
                actorStore
                    .findRemoteByUserId(user.getId())
                    .ifPresent(
                        actor ->
                            tags.add(
                                Map.of(
                                    "type",
                                    "Mention",
                                    "href",
                                    actor.actorUri(),
                                    "name",
                                    "@" + handle)));
              });
    }
    String inReplyTo;
    if (comment.getParent() != null) {
      inReplyTo = lookup.commentUri(comment.getParent().getId());
    } else {
      inReplyTo = lookup.targetUri(target.get(), owner.get().getDomain() != null).orElse(null);
    }
    if (inReplyTo == null) {
      return Optional.empty();
    }
    List<String> inboxes = new ArrayList<>();
    List<String> actors = new ArrayList<>();
    for (UUID userId : remoteUsers) {
      actorStore
          .findRemoteByUserId(userId)
          .ifPresent(
              actor -> {
                actors.add(actor.actorUri());
                String inbox = actor.sharedInbox() == null ? actor.inbox() : actor.sharedInbox();
                if (!inboxes.contains(inbox)) {
                  inboxes.add(inbox);
                }
              });
    }
    return Optional.of(new Recipients(inReplyTo, inboxes, actors, tags));
  }

  private Map<String, Object> note(CommentEntity comment, Recipients recipients) {
    UUID authorId = comment.getAuthor().getId();
    Map<String, Object> note = new LinkedHashMap<>();
    note.put("id", uris.comment(comment.getId()));
    note.put("type", "Note");
    note.put("attributedTo", uris.actor(authorId));
    note.put("inReplyTo", recipients.inReplyTo());
    note.put("to", List.of(ActivityPublisher.PUBLIC));
    List<String> cc = new ArrayList<>(recipients.actors());
    cc.add(uris.followers(authorId));
    note.put("cc", cc);
    note.put("published", comment.getCreatedAt().toString());
    if (comment.getUpdatedAt() != null) {
      note.put("updated", comment.getUpdatedAt().toString());
    }
    note.put("content", "<p>" + HtmlUtils.htmlEscape(comment.getContent()) + "</p>");
    note.put("tag", recipients.tags());
    return note;
  }

  private Map<String, Object> activity(String type, String id, UUID actorId) {
    Map<String, Object> activity = new LinkedHashMap<>();
    activity.put("@context", ActorDocuments.ACTIVITY_STREAMS);
    activity.put("id", id);
    activity.put("type", type);
    activity.put("actor", uris.actor(actorId));
    return activity;
  }

  private void deliver(UUID senderId, List<String> inboxes, Map<String, Object> activity) {
    inboxes.forEach(inbox -> deliveryService.enqueue(senderId, inbox, activity));
  }

  private boolean isFederatingLocal(UUID userId) {
    return userRepository
        .findById(userId)
        .filter(user -> user.getDomain() == null)
        .filter(user -> user.federatedVisibility() != CollectionVisibility.PRIVATE)
        .isPresent();
  }
}
