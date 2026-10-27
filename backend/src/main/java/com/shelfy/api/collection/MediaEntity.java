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
import java.util.Map;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "media")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MediaEntity {

  @Id @GeneratedValue private UUID id;

  @Column(name = "external_id", nullable = false)
  private String externalId;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "canonical_work_id", nullable = false)
  private CanonicalWorkEntity canonicalWork;

  @Column(nullable = false)
  private String provider;

  @Enumerated(EnumType.STRING)
  @Column(name = "media_type", nullable = false)
  private MediaType mediaType;

  @Column(nullable = false)
  private String title;

  @Column(name = "cover_url")
  private String coverUrl;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private Map<String, Object> metadata;

  @Column(name = "is_adult", nullable = false)
  private boolean adult;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  public MediaEntity(
      String externalId,
      String provider,
      MediaType mediaType,
      CanonicalWorkEntity canonicalWork,
      String title,
      String coverUrl,
      Map<String, Object> metadata,
      boolean adult) {
    this.externalId = externalId;
    this.provider = provider;
    this.mediaType = mediaType;
    this.canonicalWork = canonicalWork;
    this.title = title;
    this.coverUrl = coverUrl;
    this.metadata = metadata;
    this.adult = adult;
  }

  @PrePersist
  void onCreate() {
    createdAt = Instant.now();
  }
}
