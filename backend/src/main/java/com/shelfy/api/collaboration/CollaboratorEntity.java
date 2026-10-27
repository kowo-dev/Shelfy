package com.shelfy.api.collaboration;

import com.shelfy.api.lists.ListCollaboratorStatus;
import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@MappedSuperclass
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public abstract class CollaboratorEntity {
  @Id @GeneratedValue private UUID id;

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @Column(name = "invited_by", nullable = false)
  private UUID invitedBy;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private ListCollaboratorStatus status;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected CollaboratorEntity(UUID userId, UUID invitedBy) {
    this.userId = userId;
    this.invitedBy = invitedBy;
    this.status = ListCollaboratorStatus.PENDING;
  }

  public abstract Collaborative parent();

  public void accept() {
    this.status = ListCollaboratorStatus.ACCEPTED;
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
