package com.shelfy.api.versus;

import com.shelfy.api.common.IdCount;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VersusPoolLikeRepository extends JpaRepository<VersusPoolLikeEntity, UUID> {
  boolean existsByPoolIdAndUserId(UUID poolId, UUID userId);

  long countByPoolId(UUID poolId);

  void deleteByPoolIdAndUserId(UUID poolId, UUID userId);

  @Query(
      "select l.pool.id as id, count(l) as count from VersusPoolLikeEntity l"
          + " where l.pool.id in :ids group by l.pool.id")
  List<IdCount> countByPoolIds(@Param("ids") Collection<UUID> ids);
}
