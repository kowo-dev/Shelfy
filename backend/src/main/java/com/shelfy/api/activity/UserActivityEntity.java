package com.shelfy.api.activity;

import com.shelfy.api.collection.UserMediaEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "user_activity")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserActivityEntity {
  @Id @GeneratedValue private UUID id;

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_media_id")
  private UserMediaEntity userMedia;

  @Enumerated(EnumType.STRING)
  @Column(name = "activity_type", nullable = false)
  private ActivityType activityType;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private Map<String, Object> payload;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  public UserActivityEntity(
      UUID userId, UserMediaEntity userMedia, ActivityType type, Map<String, Object> payload) {
    this.userId = userId;
    this.userMedia = userMedia;
    this.activityType = type;
    this.payload = payload;
    this.createdAt = Instant.now();
  }

  public void merge(Map<String, Object> payload) {
    Map<String, Object> merged = new HashMap<>(payload);
    if (this.payload.containsKey("previous") && payload.containsKey("previous")) {
      merged.put("previous", this.payload.get("previous"));
    }
    this.payload = merged;
    this.createdAt = Instant.now();
  }
}
