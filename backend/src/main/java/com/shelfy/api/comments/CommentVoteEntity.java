package com.shelfy.api.comments;

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
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "comment_votes")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CommentVoteEntity {
  @Id @GeneratedValue private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "comment_id", nullable = false)
  private CommentEntity comment;

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @Column(nullable = false)
  private int value;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at")
  private Instant updatedAt;

  CommentVoteEntity(CommentEntity comment, UUID userId, int value) {
    this.comment = comment;
    this.userId = userId;
    this.value = value;
  }

  void change(int value) {
    this.value = value;
    this.updatedAt = Instant.now();
  }

  @PrePersist
  void created() {
    createdAt = Instant.now();
  }
}
