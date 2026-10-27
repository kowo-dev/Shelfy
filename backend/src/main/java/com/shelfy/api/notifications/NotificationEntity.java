package com.shelfy.api.notifications;

import com.shelfy.api.auth.UserEntity;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "notifications")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NotificationEntity {
  @Id @GeneratedValue private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "recipient_id", nullable = false)
  private UserEntity recipient;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "actor_id")
  private UserEntity actor;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 40)
  private NotificationType type;

  @Column(name = "target_type", length = 20)
  private String targetType;

  @Column(name = "target_id")
  private UUID targetId;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(columnDefinition = "jsonb")
  private Map<String, Object> payload;

  @Column(name = "group_key", length = 200)
  private String groupKey;

  @Column(name = "read_at")
  private Instant readAt;

  @Column(name = "resolved_at")
  private Instant resolvedAt;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  public NotificationEntity(
      UserEntity recipient,
      UserEntity actor,
      NotificationType type,
      String targetType,
      UUID targetId,
      Map<String, Object> payload) {
    this.recipient = recipient;
    this.actor = actor;
    this.type = type;
    this.targetType = targetType;
    this.targetId = targetId;
    this.payload = payload;
  }

  public void markRead() {
    if (readAt == null) {
      readAt = Instant.now();
    }
  }

  public boolean isRead() {
    return readAt != null;
  }

  public boolean isResolved() {
    return resolvedAt != null;
  }

  @PrePersist
  void created() {
    createdAt = Instant.now();
    updatedAt = createdAt;
  }
}
