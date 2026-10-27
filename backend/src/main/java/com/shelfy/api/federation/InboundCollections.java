package com.shelfy.api.federation;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.collection.MediaEntity;
import com.shelfy.api.lists.MediaListEntity;
import com.shelfy.api.lists.MediaListRepository;
import com.shelfy.api.versus.ClipInfo;
import com.shelfy.api.versus.ClipProvider;
import com.shelfy.api.versus.VersusPoolEntity;
import com.shelfy.api.versus.VersusPoolItemEntity;
import com.shelfy.api.versus.VersusPoolRepository;
import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;

@Component
@RequiredArgsConstructor
public class InboundCollections {

  private static final int MAX_NAME = 300;
  private static final int MAX_DESCRIPTION = 500;
  private static final int MAX_TAGS = 20;
  private static final int MAX_TAG = 100;

  private final JdbcClient jdbcClient;
  private final Works works;
  private final ObjectLookup lookup;
  private final MediaListRepository listRepository;
  private final VersusPoolRepository poolRepository;
  private final TransactionTemplate transactionTemplate;

  record Clip(ClipInfo info, MediaEntity media) {}

  public static boolean isCollection(JsonNode object) {
    return object.has("shelfy:list") || object.has("shelfy:versusPool");
  }

  public void onCreateOrUpdate(UserEntity signer, String signerUri, JsonNode note) {
    if (lookup.hasLocalAudience(signer.getId())) {
      onSnapshot(signer, signerUri, note);
    }
  }

  public void onSnapshot(UserEntity signer, String signerUri, JsonNode note) {
    String noteId = Activities.idOf(note);
    if (noteId == null
        || !signerUri.equals(Activities.idOf(note.path("attributedTo")))
        || !sameHost(noteId, signerUri)) {
      return;
    }
    CollectionVisibility visibility =
        note.path("to").toString().contains(ActivityPublisher.PUBLIC)
            ? CollectionVisibility.PUBLIC
            : CollectionVisibility.PRIVATE;
    if (note.has("shelfy:list")) {
      list(signer, noteId, note.path("shelfy:list"), visibility);
    } else {
      pool(signer, noteId, note.path("shelfy:versusPool"), visibility);
    }
  }

  public boolean onDelete(UserEntity signer, String objectId) {
    Optional<Mapping> mapping = mapping(signer.getId(), objectId);
    mapping.ifPresent(
        found ->
            transactionTemplate.executeWithoutResult(
                status -> {
                  if (found.kind().equals("LIST")) {
                    listRepository.deleteById(found.localId());
                  } else {
                    poolRepository.deleteById(found.localId());
                  }
                  jdbcClient
                      .sql("delete from ap_remote_collections where ap_id = :apId")
                      .param("apId", objectId)
                      .update();
                }));
    return mapping.isPresent();
  }

  record Mapping(String kind, UUID localId) {}

  private void list(
      UserEntity signer, String noteId, JsonNode state, CollectionVisibility visibility) {
    String name = trimmed(Activities.text(state, "name"), MAX_NAME);
    if (name == null) {
      return;
    }
    String description = trimmed(Activities.text(state, "description"), MAX_DESCRIPTION);
    Set<String> tags = new LinkedHashSet<>();
    state
        .path("tags")
        .forEach(
            tag -> {
              String value = tag.isString() ? trimmed(tag.asString(), MAX_TAG) : null;
              if (value != null && tags.size() < MAX_TAGS) {
                tags.add(value);
              }
            });
    List<MediaEntity> media = resolveListItems(state);
    transactionTemplate.executeWithoutResult(
        status -> {
          MediaListEntity list =
              mapping(signer.getId(), noteId)
                  .filter(found -> found.kind().equals("LIST"))
                  .flatMap(found -> listRepository.findById(found.localId()))
                  .filter(found -> found.getUserId().equals(signer.getId()))
                  .orElseGet(
                      () ->
                          new MediaListEntity(signer.getId(), name, description, visibility, tags));
          list.updateDetails(name, description, visibility, tags);
          applyListItems(list, media, signer.getId());
          MediaListEntity saved = listRepository.save(list);
          map(noteId, "LIST", saved.getId(), signer.getId());
        });
  }

  private void pool(
      UserEntity signer, String noteId, JsonNode state, CollectionVisibility visibility) {
    String name = trimmed(Activities.text(state, "name"), MAX_NAME);
    if (name == null) {
      return;
    }
    String description = trimmed(Activities.text(state, "description"), MAX_DESCRIPTION);
    PoolItems items = resolvePoolItems(state);
    transactionTemplate.executeWithoutResult(
        status -> {
          VersusPoolEntity pool =
              mapping(signer.getId(), noteId)
                  .filter(found -> found.kind().equals("POOL"))
                  .flatMap(found -> poolRepository.findById(found.localId()))
                  .filter(found -> found.getUserId().equals(signer.getId()))
                  .orElseGet(
                      () -> new VersusPoolEntity(signer.getId(), name, description, visibility));
          pool.update(name, description, visibility);
          applyPoolItems(pool, items, signer.getId());
          VersusPoolEntity saved = poolRepository.save(pool);
          map(noteId, "POOL", saved.getId(), signer.getId());
        });
  }

  record PoolItems(List<MediaEntity> media, List<Clip> clips) {}

  List<MediaEntity> resolveListItems(JsonNode state) {
    List<MediaEntity> media = new ArrayList<>();
    for (JsonNode work : limited(state.path("items"))) {
      works
          .resolve(work)
          .filter(found -> media.stream().noneMatch(m -> m.getId().equals(found.getId())))
          .ifPresent(media::add);
    }
    return media;
  }

  void applyListItems(MediaListEntity list, List<MediaEntity> media, UUID addedBy) {
    Set<UUID> wanted = new LinkedHashSet<>();
    media.forEach(item -> wanted.add(item.getId()));
    List<UUID> stale =
        list.getItems().stream()
            .map(item -> item.getMedia().getId())
            .filter(id -> !wanted.contains(id))
            .toList();
    stale.forEach(list::removeItemByMedia);
    for (MediaEntity item : media) {
      if (!list.containsMedia(item.getId())) {
        list.appendItem(item, addedBy);
      }
    }
    list.reorder(List.copyOf(wanted));
  }

  PoolItems resolvePoolItems(JsonNode state) {
    List<MediaEntity> media = new ArrayList<>();
    List<Clip> clips = new ArrayList<>();
    for (JsonNode entry : limited(state.path("items"))) {
      Optional<MediaEntity> work =
          entry.has("work") ? works.resolve(entry.path("work")) : Optional.empty();
      Optional<ClipInfo> clip = clip(entry.path("clip"));
      if (clip.isPresent()) {
        clips.add(new Clip(clip.get(), work.orElse(null)));
      } else {
        work.filter(found -> media.stream().noneMatch(m -> m.getId().equals(found.getId())))
            .ifPresent(media::add);
      }
    }
    return new PoolItems(media, clips);
  }

  void applyPoolItems(VersusPoolEntity pool, PoolItems items, UUID addedBy) {
    List<UUID> stale = new ArrayList<>();
    for (VersusPoolItemEntity item : pool.getItems()) {
      boolean kept =
          item.isClip()
              ? items.clips().stream()
                  .anyMatch(
                      clip ->
                          clip.info().provider().value().equals(item.getClipProvider())
                              && clip.info().externalId().equals(item.getClipExternalId()))
              : items.media().stream().anyMatch(m -> m.getId().equals(item.getMedia().getId()));
      if (!kept) {
        stale.add(item.getId());
      }
    }
    pool.removeItems(stale);
    for (MediaEntity item : items.media()) {
      if (!pool.containsMedia(item.getId())) {
        pool.appendItem(item, addedBy);
      }
    }
    for (Clip clip : items.clips()) {
      if (!pool.containsClip(clip.info())) {
        pool.appendClip(clip.info(), clip.info().startSeconds(), clip.media(), addedBy);
      }
    }
  }

  private static Optional<ClipInfo> clip(JsonNode clip) {
    if (!clip.isObject()) {
      return Optional.empty();
    }
    Optional<ClipProvider> provider =
        Arrays.stream(ClipProvider.values())
            .filter(value -> value.value().equals(Activities.text(clip, "provider")))
            .findFirst();
    String externalId = trimmed(Activities.text(clip, "externalId"), 200);
    String title = trimmed(Activities.text(clip, "title"), 300);
    if (provider.isEmpty() || externalId == null || title == null) {
      return Optional.empty();
    }
    String thumbnail = Activities.text(clip, "thumbnailUrl");
    Integer start =
        clip.path("startSeconds").isInt() && clip.path("startSeconds").asInt() >= 0
            ? clip.path("startSeconds").asInt()
            : null;
    return Optional.of(
        new ClipInfo(
            provider.get(),
            externalId,
            title,
            trimmed(Activities.text(clip, "author"), 200),
            thumbnail != null && thumbnail.startsWith("https://") ? thumbnail : null,
            start));
  }

  private static List<JsonNode> limited(JsonNode items) {
    List<JsonNode> result = new ArrayList<>();
    for (JsonNode item : items) {
      if (result.size() >= CollectionPublisher.MAX_ITEMS) {
        break;
      }
      result.add(item);
    }
    return result;
  }

  private Optional<Mapping> mapping(UUID userId, String apId) {
    return jdbcClient
        .sql(
            "select kind, local_id from ap_remote_collections where ap_id = :apId and user_id = :userId")
        .param("apId", apId)
        .param("userId", userId)
        .query(Mapping.class)
        .optional();
  }

  private void map(String apId, String kind, UUID localId, UUID userId) {
    jdbcClient
        .sql(
            """
            insert into ap_remote_collections (ap_id, kind, local_id, user_id)
            values (:apId, :kind, :localId, :userId) on conflict do nothing
            """)
        .param("apId", apId)
        .param("kind", kind)
        .param("localId", localId)
        .param("userId", userId)
        .update();
  }

  private static String trimmed(String value, int max) {
    if (value == null || value.isBlank()) {
      return null;
    }
    String trimmed = value.strip();
    return trimmed.length() <= max ? trimmed : trimmed.substring(0, max);
  }

  private static boolean sameHost(String a, String b) {
    try {
      return Objects.equals(URI.create(a).getRawAuthority(), URI.create(b).getRawAuthority());
    } catch (IllegalArgumentException e) {
      return false;
    }
  }
}
