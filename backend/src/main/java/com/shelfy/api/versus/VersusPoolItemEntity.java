package com.shelfy.api.versus;

import com.shelfy.api.collection.MediaEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "versus_pool_items")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VersusPoolItemEntity {

  @Id @GeneratedValue private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "pool_id")
  private VersusPoolEntity pool;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "media_id")
  private MediaEntity media;

  @Column(name = "clip_provider")
  private String clipProvider;

  @Column(name = "clip_external_id")
  private String clipExternalId;

  @Column(name = "clip_title")
  private String clipTitle;

  @Column(name = "clip_author")
  private String clipAuthor;

  @Column(name = "clip_thumbnail_url")
  private String clipThumbnailUrl;

  @Column(name = "clip_start_seconds")
  private Integer clipStartSeconds;

  @Column(name = "added_at", nullable = false, updatable = false)
  private Instant addedAt;

  @Column(name = "added_by")
  private UUID addedBy;

  VersusPoolItemEntity(VersusPoolEntity pool, MediaEntity media, UUID addedBy) {
    this.pool = pool;
    this.media = media;
    this.addedBy = addedBy;
  }

  VersusPoolItemEntity(
      VersusPoolEntity pool,
      ClipInfo clip,
      Integer startSeconds,
      MediaEntity linkedMedia,
      UUID addedBy) {
    this.pool = pool;
    this.media = linkedMedia;
    this.addedBy = addedBy;
    this.clipProvider = clip.provider().value();
    this.clipExternalId = clip.externalId();
    this.clipTitle = clip.title();
    this.clipAuthor = clip.author();
    this.clipThumbnailUrl = clip.thumbnailUrl();
    this.clipStartSeconds = startSeconds;
  }

  VersusPoolItemEntity copyInto(VersusPoolEntity target) {
    VersusPoolItemEntity copy = new VersusPoolItemEntity(target, media, target.getUserId());
    copy.clipProvider = clipProvider;
    copy.clipExternalId = clipExternalId;
    copy.clipTitle = clipTitle;
    copy.clipAuthor = clipAuthor;
    copy.clipThumbnailUrl = clipThumbnailUrl;
    copy.clipStartSeconds = clipStartSeconds;
    return copy;
  }

  void updateClip(Integer startSeconds, MediaEntity linkedMedia) {
    this.clipStartSeconds = startSeconds;
    this.media = linkedMedia;
  }

  public boolean isClip() {
    return clipProvider != null;
  }

  @PrePersist
  void created() {
    addedAt = Instant.now();
  }
}
