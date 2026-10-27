package com.shelfy.api.essentials;

import com.shelfy.api.collection.UserMediaEntity;
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
@Table(name = "essential_entries")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EssentialEntryEntity {

  @Id @GeneratedValue private UUID id;

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_media_id", nullable = false)
  private UserMediaEntity userMedia;

  @Column(nullable = false)
  private int slot;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  public EssentialEntryEntity(UUID userId, UserMediaEntity userMedia, int slot) {
    this.userId = userId;
    this.userMedia = userMedia;
    this.slot = slot;
  }

  @PrePersist
  void onCreate() {
    createdAt = Instant.now();
  }
}
