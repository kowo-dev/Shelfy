package com.shelfy.api.follows;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "follows")
@IdClass(FollowEntity.FollowId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class FollowEntity {

  @Id
  @Column(name = "follower_id", nullable = false)
  private UUID followerId;

  @Id
  @Column(name = "followed_id", nullable = false)
  private UUID followedId;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Setter
  @Column(name = "favorite", nullable = false)
  private boolean favorite;

  public FollowEntity(UUID followerId, UUID followedId) {
    this.followerId = followerId;
    this.followedId = followedId;
  }

  @PrePersist
  void onCreate() {
    createdAt = Instant.now();
  }

  @Getter
  @EqualsAndHashCode
  @NoArgsConstructor(access = AccessLevel.PROTECTED)
  public static class FollowId implements Serializable {
    private UUID followerId;
    private UUID followedId;

    public FollowId(UUID followerId, UUID followedId) {
      this.followerId = followerId;
      this.followedId = followedId;
    }
  }
}
