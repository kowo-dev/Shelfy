package com.shelfy.api.lists;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.collaboration.Collaborative;
import com.shelfy.api.collection.MediaEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "media_lists")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MediaListEntity implements Collaborative {
  @Id @GeneratedValue private UUID id;

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @Column(nullable = false, length = 300)
  private String name;

  @Column(columnDefinition = "text")
  private String description;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private CollectionVisibility visibility;

  @ElementCollection
  @CollectionTable(name = "media_list_tags", joinColumns = @JoinColumn(name = "list_id"))
  @Column(name = "tag", length = 100)
  private Set<String> tags = new LinkedHashSet<>();

  @OneToMany(mappedBy = "list", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<MediaListItemEntity> items = new ArrayList<>();

  @Column(name = "source_list_id")
  private UUID sourceListId;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  public MediaListEntity(
      UUID userId,
      String name,
      String description,
      CollectionVisibility visibility,
      Set<String> tags) {
    this.userId = userId;
    this.name = name;
    this.description = description;
    this.visibility = visibility;
    this.tags = new LinkedHashSet<>(tags);
  }

  public void copiedFrom(UUID sourceListId) {
    this.sourceListId = sourceListId;
  }

  public void addItem(MediaEntity media, int position, UUID addedBy) {
    items.add(new MediaListItemEntity(this, media, position, addedBy));
  }

  public boolean containsMedia(UUID mediaId) {
    return items.stream().anyMatch(item -> item.getMedia().getId().equals(mediaId));
  }

  public MediaListItemEntity appendItem(MediaEntity media) {
    return appendItem(media, userId);
  }

  public MediaListItemEntity appendItem(MediaEntity media, UUID addedBy) {
    int nextPosition =
        items.stream().mapToInt(MediaListItemEntity::getPosition).max().orElse(-1) + 1;
    MediaListItemEntity item = new MediaListItemEntity(this, media, nextPosition, addedBy);
    items.add(item);
    return item;
  }

  public boolean removeItemByMedia(UUID mediaId) {
    return items.removeIf(item -> item.getMedia().getId().equals(mediaId));
  }

  public boolean reorder(List<UUID> mediaIds) {
    Map<UUID, MediaListItemEntity> byMedia = new HashMap<>();
    items.forEach(item -> byMedia.put(item.getMedia().getId(), item));
    if (mediaIds.size() != byMedia.size() || !byMedia.keySet().containsAll(mediaIds)) {
      return false;
    }
    for (int position = 0; position < mediaIds.size(); position++) {
      byMedia.get(mediaIds.get(position)).moveTo(position);
    }
    return true;
  }

  public void updateDetails(
      String name, String description, CollectionVisibility visibility, Set<String> tags) {
    this.name = name;
    this.description = description;
    this.visibility = visibility;
    this.tags.clear();
    this.tags.addAll(tags);
  }

  public void update(
      String name, String description, CollectionVisibility visibility, Set<String> tags) {
    this.name = name;
    this.description = description;
    this.visibility = visibility;
    this.tags.clear();
    this.tags.addAll(tags);
    this.items.clear();
  }

  @PrePersist
  void created() {
    createdAt = Instant.now();
    updatedAt = createdAt;
  }

  @PreUpdate
  void updated() {
    updatedAt = Instant.now();
  }
}
