package com.shelfy.api.comments;

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
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "comments")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CommentEntity {
  @Id @GeneratedValue private UUID id;

  @Enumerated(EnumType.STRING)
  @Column(name = "target_type", nullable = false)
  private CommentTargetType targetType;

  @Column(name = "target_id", nullable = false)
  private UUID targetId;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "author_id", nullable = false)
  private UserEntity author;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "parent_comment_id")
  private CommentEntity parent;

  @Column(nullable = false, length = 500)
  private String content;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at")
  private Instant updatedAt;

  @Column(nullable = false)
  private int upvotes;

  @Column(nullable = false)
  private int downvotes;

  @Column(name = "deleted_at")
  private Instant deletedAt;

  CommentEntity(
      CommentTargetType targetType,
      UUID targetId,
      UserEntity author,
      String content,
      CommentEntity parent) {
    this.targetType = targetType;
    this.targetId = targetId;
    this.author = author;
    this.content = content;
    this.parent = parent;
  }

  void edit(String content) {
    this.content = content;
    this.updatedAt = Instant.now();
  }

  void markDeleted() {
    this.content = "";
    this.deletedAt = Instant.now();
  }

  public boolean isDeleted() {
    return deletedAt != null;
  }

  boolean isAuthoredBy(UUID userId) {
    return author.getId().equals(userId);
  }

  void updateVoteCounts(int upvotes, int downvotes) {
    this.upvotes = upvotes;
    this.downvotes = downvotes;
  }

  @PrePersist
  void created() {
    createdAt = Instant.now();
  }
}
