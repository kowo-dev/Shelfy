package com.shelfy.api.users;

import com.shelfy.api.collection.UserMediaEntity;
import com.shelfy.api.common.LikeEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "review_likes")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ReviewLikeEntity extends LikeEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "review_id", nullable = false)
  private UserMediaEntity review;

  ReviewLikeEntity(UserMediaEntity review, UUID userId) {
    super(userId);
    this.review = review;
  }
}
