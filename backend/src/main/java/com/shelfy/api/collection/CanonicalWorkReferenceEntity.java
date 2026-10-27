package com.shelfy.api.collection;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
@Table(name = "canonical_work_references")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CanonicalWorkReferenceEntity {

  @Id @GeneratedValue private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "canonical_work_id", nullable = false)
  private CanonicalWorkEntity canonicalWork;

  @Column(nullable = false)
  private String provider;

  @Enumerated(EnumType.STRING)
  @Column(name = "media_type", nullable = false)
  private MediaType mediaType;

  @Column(name = "external_id", nullable = false)
  private String externalId;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  public CanonicalWorkReferenceEntity(
      CanonicalWorkEntity canonicalWork, String provider, MediaType mediaType, String externalId) {
    this.canonicalWork = canonicalWork;
    this.provider = provider;
    this.mediaType = mediaType;
    this.externalId = externalId;
  }

  @PrePersist
  void onCreate() {
    createdAt = Instant.now();
  }
}
