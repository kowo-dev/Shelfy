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
public abstract class ImportJobEntity implements ImportJob {

  @Id @GeneratedValue private UUID id;

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private ImportStatus status = ImportStatus.PENDING;

  @Column(name = "entries_total", nullable = false)
  private int entriesTotal;

  @Column(name = "entries_imported", nullable = false)
  private int entriesImported;

  @Column(name = "entries_skipped", nullable = false)
  private int entriesSkipped;

  @Column(name = "error_message")
  private String errorMessage;

  @Column(name = "started_at")
  private Instant startedAt;

  @Column(name = "completed_at")
  private Instant completedAt;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  protected ImportJobEntity(UUID userId) {
    this.userId = userId;
  }

  @Override
  public void start() {
    status = ImportStatus.PROCESSING;
    startedAt = Instant.now();
  }

  @Override
  public void total(int total) {
    entriesTotal = total;
  }

  @Override
  public void progress(int imported, int skipped) {
    entriesImported = imported;
    entriesSkipped = skipped;
  }

  @Override
  public void complete() {
    status = ImportStatus.COMPLETED;
    completedAt = Instant.now();
  }

  @Override
  public void fail(String code) {
    status = ImportStatus.FAILED;
    errorMessage = code;
    completedAt = Instant.now();
  }

  @PrePersist
  void onCreate() {
    createdAt = Instant.now();
  }
}
