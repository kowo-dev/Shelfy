package com.shelfy.api.common;

import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@MappedSuperclass
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public abstract class ImportEntryEntity {

  @Id @GeneratedValue private UUID id;

  @Column(name = "import_id", nullable = false)
  private UUID importId;

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private ImportEntryStatus status;

  @Column private String reason;

  @Column(name = "reason_detail")
  private String reasonDetail;

  @Column(name = "media_id")
  private UUID mediaId;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  protected ImportEntryEntity(
      UUID importId,
      UUID userId,
      ImportEntryStatus status,
      String reason,
      String reasonDetail,
      UUID mediaId) {
    this.importId = importId;
    this.userId = userId;
    this.status = status;
    this.reason = reason;
    this.reasonDetail = reasonDetail;
    this.mediaId = mediaId;
  }

  @PrePersist
  void onCreate() {
    createdAt = Instant.now();
  }
}
