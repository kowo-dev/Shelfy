package com.shelfy.api.collection;

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
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "watch_log")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WatchLogEntity {

  @Id @GeneratedValue private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_media_id", nullable = false)
  private UserMediaEntity userMedia;

  @Column(name = "occurred_at", nullable = false)
  private LocalDate occurredAt;

  @Column(name = "is_repeat", nullable = false)
  private boolean repeat;

  @Column(length = 120)
  private String name;

  @Column private Integer rating;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(columnDefinition = "jsonb")
  private Map<String, Object> review;

  @Column(name = "contains_spoilers", nullable = false)
  private boolean containsSpoilers;

  @Column(nullable = false)
  private String source;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  public WatchLogEntity(
      UserMediaEntity userMedia, LocalDate occurredAt, boolean repeat, String source) {
    this.userMedia = userMedia;
    this.occurredAt = occurredAt;
    this.repeat = repeat;
    this.source = source;
  }

  @PrePersist
  void onCreate() {
    createdAt = Instant.now();
  }
}
