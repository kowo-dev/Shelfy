package com.shelfy.api.users;

import com.shelfy.api.common.IdCount;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewLikeRepository extends JpaRepository<ReviewLikeEntity, UUID> {
  boolean existsByReviewIdAndUserId(UUID reviewId, UUID userId);

  void deleteByReviewIdAndUserId(UUID reviewId, UUID userId);

  @Query(
      "select l.review.id as id, count(l) as count from ReviewLikeEntity l"
          + " where l.review.id in :ids group by l.review.id")
  List<IdCount> countByReviewIds(@Param("ids") Collection<UUID> ids);

  @Query(
      "select l.review.id from ReviewLikeEntity l where l.userId = :userId and l.review.id in :ids")
  List<UUID> findLikedReviewIds(@Param("userId") UUID userId, @Param("ids") Collection<UUID> ids);
}
