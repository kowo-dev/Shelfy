package com.shelfy.api.federation;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.comments.CommentTargetType;
import com.shelfy.api.lists.MediaListEntity;
import com.shelfy.api.lists.MediaListItemEntity;
import com.shelfy.api.lists.MediaListRepository;
import com.shelfy.api.versus.VersusPoolEntity;
import com.shelfy.api.versus.VersusPoolItemEntity;
import com.shelfy.api.versus.VersusPoolRepository;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

@Component
@RequiredArgsConstructor
public class CollectionPublisher {

  static final int MAX_ITEMS = 500;
  private static final int PREVIEW_ITEMS = 20;

  private final FederationProperties properties;
  private final FederationUris uris;
  private final ActivityPublisher activityPublisher;
  private final DeliveryService deliveryService;
  private final Works works;
  private final JdbcClient jdbcClient;
  private final MediaListRepository listRepository;
  private final VersusPoolRepository poolRepository;
  private final CollaboratorPublisher collaboratorPublisher;

  @Transactional
  public void invited(CommentTargetType type, UUID collectionId, UUID ownerId, UUID inviteeId) {
    if (!properties.enabled()) {
      return;
    }
    Map<String, Object> snapshot =
        type == CommentTargetType.LIST
            ? listRepository.findById(collectionId).map(this::listNote).orElse(null)
            : poolRepository.findById(collectionId).map(this::poolNote).orElse(null);
    if (snapshot != null) {
      collaboratorPublisher.invited(ownerId, inviteeId, snapshot);
    }
  }

  @Transactional
  public void listChanged(MediaListEntity list, UUID editorId) {
    if (isRemote(list.getUserId())) {
      collaboratorPublisher.edited(
          CommentTargetType.LIST,
          list.getId(),
          list.getUserId(),
          editorId,
          "shelfy:list",
          castState(listNote(list).get("shelfy:list")));
      return;
    }
    changed(
        list.getUserId(),
        list.getId(),
        uris.list(list.getId()),
        list.getVisibility(),
        () -> listNote(list));
  }

  @Transactional
  public void listDeleted(MediaListEntity list) {
    deleted(list.getUserId(), list.getId(), uris.list(list.getId()));
  }

  @Transactional
  public void poolChanged(VersusPoolEntity pool, UUID editorId) {
    if (isRemote(pool.getUserId())) {
      collaboratorPublisher.edited(
          CommentTargetType.VERSUS_POOL,
          pool.getId(),
          pool.getUserId(),
          editorId,
          "shelfy:versusPool",
          castState(poolNote(pool).get("shelfy:versusPool")));
      return;
    }
    changed(
        pool.getUserId(),
        pool.getId(),
        uris.pool(pool.getId()),
        pool.getVisibility(),
        () -> poolNote(pool));
  }

  @Transactional
  public void poolDeleted(VersusPoolEntity pool) {
    deleted(pool.getUserId(), pool.getId(), uris.pool(pool.getId()));
  }

  @Transactional(readOnly = true)
  public Optional<Map<String, Object>> listDocument(UUID listId) {
    return listRepository
        .findById(listId)
        .filter(list -> isPublic(list.getUserId(), list.getVisibility()))
        .map(list -> document(listNote(list), list.getUserId()));
  }

  @Transactional(readOnly = true)
  public Optional<Map<String, Object>> poolDocument(UUID poolId) {
    return poolRepository
        .findById(poolId)
        .filter(pool -> isPublic(pool.getUserId(), pool.getVisibility()))
        .map(pool -> document(poolNote(pool), pool.getUserId()));
  }

  private interface NoteBuilder {
    Map<String, Object> build();
  }

  private void changed(
      UUID ownerId,
      UUID objectId,
      String objectUri,
      CollectionVisibility visibility,
      NoteBuilder builder) {
    if (!properties.enabled()) {
      return;
    }
    Optional<ActivityPublisher.Audience> audience = activityPublisher.audience(ownerId, visibility);
    if (audience.isEmpty()) {
      deleted(ownerId, objectId, objectUri);
      return;
    }
    Map<String, Object> note = builder.build();
    List<ActorStore.RemoteActor> collaborators = remoteCollaborators(objectId);
    List<String> to = new ArrayList<>(audience.get().to());
    List<String> inboxes = new ArrayList<>(audience.get().inboxes());
    for (ActorStore.RemoteActor collaborator : collaborators) {
      if (!to.contains(collaborator.actorUri())) {
        to.add(collaborator.actorUri());
      }
      if (!inboxes.contains(collaborator.inbox())) {
        inboxes.add(collaborator.inbox());
      }
    }
    note.put("to", to);
    note.put("cc", audience.get().cc());
    boolean first =
        jdbcClient
                .sql(
                    "insert into ap_published_objects (object_id) values (:id) on conflict do nothing")
                .param("id", objectId)
                .update()
            == 1;
    String type = first ? "Create" : "Update";
    String id = note.get("id") + (first ? "/create" : "/update/" + System.currentTimeMillis());
    Map<String, Object> activity = new LinkedHashMap<>();
    activity.put("@context", ActorDocuments.CONTEXT);
    activity.put("id", id);
    activity.put("type", type);
    activity.put("actor", uris.actor(ownerId));
    activity.put("to", note.get("to"));
    activity.put("cc", note.get("cc"));
    activity.put("object", note);
    inboxes.forEach(inbox -> deliveryService.enqueue(ownerId, inbox, activity));
  }

  private List<ActorStore.RemoteActor> remoteCollaborators(UUID collectionId) {
    return jdbcClient
        .sql(
            """
            select a.user_id, a.actor_uri, a.inbox, a.shared_inbox, a.outbox, a.followers_uri,
                   a.following_uri, a.profile_url, a.avatar_url, a.public_key_id,
                   a.public_key_pem, a.fetched_at
            from ap_actors a
            where a.actor_uri is not null and a.user_id in (
              select user_id from media_list_collaborators where list_id = :id
              union select user_id from versus_pool_collaborators where pool_id = :id)
            """)
        .param("id", collectionId)
        .query(ActorStore.RemoteActor.class)
        .list();
  }

  private boolean isRemote(UUID userId) {
    return jdbcClient
        .sql("select exists (select 1 from users where id = :id and domain is not null)")
        .param("id", userId)
        .query(Boolean.class)
        .single();
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> castState(Object state) {
    return (Map<String, Object>) state;
  }

  private void deleted(UUID ownerId, UUID objectId, String objectUri) {
    if (!properties.enabled()) {
      return;
    }
    boolean published =
        jdbcClient
                .sql("delete from ap_published_objects where object_id = :id")
                .param("id", objectId)
                .update()
            == 1;
    if (!published) {
      return;
    }
    List<String> inboxes =
        activityPublisher
            .audience(ownerId, CollectionVisibility.PUBLIC)
            .map(ActivityPublisher.Audience::inboxes)
            .orElse(List.of());
    Map<String, Object> delete = new LinkedHashMap<>();
    delete.put("@context", ActorDocuments.ACTIVITY_STREAMS);
    delete.put("id", objectUri + "/delete");
    delete.put("type", "Delete");
    delete.put("actor", uris.actor(ownerId));
    delete.put("to", List.of(ActivityPublisher.PUBLIC));
    delete.put("object", Map.of("id", objectUri, "type", "Tombstone"));
    inboxes.forEach(inbox -> deliveryService.enqueue(ownerId, inbox, delete));
  }

  private boolean isPublic(UUID ownerId, CollectionVisibility visibility) {
    return activityPublisher
        .audience(ownerId, visibility)
        .map(audience -> audience.to().contains(ActivityPublisher.PUBLIC))
        .orElse(false);
  }

  private Map<String, Object> document(Map<String, Object> note, UUID ownerId) {
    Map<String, Object> doc = new LinkedHashMap<>();
    doc.put("@context", ActorDocuments.CONTEXT);
    doc.putAll(note);
    doc.put("to", List.of(ActivityPublisher.PUBLIC));
    doc.put("cc", List.of(uris.followers(ownerId)));
    return doc;
  }

  private Map<String, Object> listNote(MediaListEntity list) {
    List<MediaListItemEntity> items =
        list.getItems().stream()
            .sorted(Comparator.comparingInt(MediaListItemEntity::getPosition))
            .limit(MAX_ITEMS)
            .toList();
    List<String> titles = items.stream().map(item -> item.getMedia().getTitle()).toList();
    Map<String, Object> state = new LinkedHashMap<>();
    state.put("name", list.getName());
    state.put("description", list.getDescription());
    state.put("tags", List.copyOf(list.getTags()));
    state.put("items", items.stream().map(item -> works.describe(item.getMedia())).toList());
    Map<String, Object> note =
        note(
            uris.list(list.getId()),
            list.getUserId(),
            "/lists/" + list.getId(),
            list.getName(),
            "List",
            list.getDescription(),
            titles);
    note.put("shelfy:list", state);
    return note;
  }

  private Map<String, Object> poolNote(VersusPoolEntity pool) {
    List<VersusPoolItemEntity> items = pool.getItems().stream().limit(MAX_ITEMS).toList();
    List<String> titles =
        items.stream()
            .map(item -> item.isClip() ? item.getClipTitle() : item.getMedia().getTitle())
            .toList();
    List<Map<String, Object>> entries = new ArrayList<>();
    for (VersusPoolItemEntity item : items) {
      Map<String, Object> entry = new LinkedHashMap<>();
      if (item.isClip()) {
        Map<String, Object> clip = new LinkedHashMap<>();
        clip.put("provider", item.getClipProvider());
        clip.put("externalId", item.getClipExternalId());
        clip.put("title", item.getClipTitle());
        clip.put("author", item.getClipAuthor());
        clip.put("thumbnailUrl", item.getClipThumbnailUrl());
        clip.put("startSeconds", item.getClipStartSeconds());
        entry.put("clip", clip);
      }
      if (item.getMedia() != null) {
        entry.put("work", works.describe(item.getMedia()));
      }
      entries.add(entry);
    }
    Map<String, Object> state = new LinkedHashMap<>();
    state.put("name", pool.getName());
    state.put("description", pool.getDescription());
    state.put("items", entries);
    Map<String, Object> note =
        note(
            uris.pool(pool.getId()),
            pool.getUserId(),
            "/versus/" + pool.getId(),
            pool.getName(),
            "Versus",
            pool.getDescription(),
            titles);
    note.put("shelfy:versusPool", state);
    return note;
  }

  private Map<String, Object> note(
      String id,
      UUID ownerId,
      String path,
      String name,
      String label,
      String description,
      List<String> titles) {
    StringBuilder content = new StringBuilder();
    content
        .append("<p>")
        .append(label)
        .append(": <a href=\"")
        .append(uris.web(path))
        .append("\">")
        .append(HtmlUtils.htmlEscape(name))
        .append("</a></p>");
    if (description != null && !description.isBlank()) {
      content.append("<p>").append(HtmlUtils.htmlEscape(description)).append("</p>");
    }
    if (!titles.isEmpty()) {
      content.append("<ol>");
      titles.stream()
          .limit(PREVIEW_ITEMS)
          .forEach(
              title -> content.append("<li>").append(HtmlUtils.htmlEscape(title)).append("</li>"));
      content.append("</ol>");
    }
    Map<String, Object> note = new LinkedHashMap<>();
    note.put("id", id);
    note.put("type", "Note");
    note.put("attributedTo", uris.actor(ownerId));
    note.put("name", name);
    note.put("url", uris.web(path));
    note.put("content", content.toString());
    return note;
  }
}
