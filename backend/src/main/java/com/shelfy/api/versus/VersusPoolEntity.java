package com.shelfy.api.versus;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.collaboration.Collaborative;
import com.shelfy.api.collection.MediaEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "versus_pools")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VersusPoolEntity implements Collaborative {
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

  @OneToMany(mappedBy = "pool", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<VersusPoolItemEntity> items = new ArrayList<>();

  @Column(name = "source_pool_id")
  private UUID sourcePoolId;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  public VersusPoolEntity(
      UUID userId, String name, String description, CollectionVisibility visibility) {
    this.userId = userId;
    this.name = name;
    this.description = description;
    this.visibility = visibility;
  }

  public void update(String name, String description, CollectionVisibility visibility) {
    this.name = name;
    this.description = description;
    this.visibility = visibility;
  }

  public void copiedFrom(UUID sourcePoolId) {
    this.sourcePoolId = sourcePoolId;
  }

  public void appendCopyOf(VersusPoolItemEntity source) {
    items.add(source.copyInto(this));
  }

  public boolean containsMedia(UUID mediaId) {
    return items.stream()
        .anyMatch(item -> !item.isClip() && item.getMedia().getId().equals(mediaId));
  }

  public boolean containsClip(ClipInfo clip) {
    return items.stream()
        .anyMatch(
            item ->
                clip.provider().value().equals(item.getClipProvider())
                    && clip.externalId().equals(item.getClipExternalId()));
  }

  public VersusPoolItemEntity appendClip(
      ClipInfo clip, Integer startSeconds, MediaEntity linkedMedia) {
    return appendClip(clip, startSeconds, linkedMedia, userId);
  }

  public VersusPoolItemEntity appendClip(
      ClipInfo clip, Integer startSeconds, MediaEntity linkedMedia, UUID addedBy) {
    VersusPoolItemEntity item =
        new VersusPoolItemEntity(this, clip, startSeconds, linkedMedia, addedBy);
    items.add(item);
    return item;
  }

  public VersusPoolItemEntity appendItem(MediaEntity media) {
    return appendItem(media, userId);
  }

  public VersusPoolItemEntity appendItem(MediaEntity media, UUID addedBy) {
    VersusPoolItemEntity item = new VersusPoolItemEntity(this, media, addedBy);
    items.add(item);
    return item;
  }

  public boolean removeItem(UUID itemId) {
    return items.removeIf(item -> item.getId().equals(itemId));
  }

  public int removeItems(Collection<UUID> itemIds) {
    Set<UUID> ids = Set.copyOf(itemIds);
    int before = items.size();
    items.removeIf(item -> ids.contains(item.getId()));
    return before - items.size();
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
