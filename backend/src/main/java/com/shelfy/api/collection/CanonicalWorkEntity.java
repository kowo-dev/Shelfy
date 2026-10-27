package com.shelfy.api.collection;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "canonical_works")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CanonicalWorkEntity {

  @Id private UUID id;

  @Enumerated(EnumType.STRING)
  @Column(name = "media_type", nullable = false)
  private MediaType mediaType;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  public CanonicalWorkEntity(MediaType mediaType) {
    this.id = UUID.randomUUID();
    this.mediaType = mediaType;
  }

  @PrePersist
  void onCreate() {
    createdAt = Instant.now();
  }
}
