package com.shelfy.api.versus;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VersusSessionRepository extends JpaRepository<VersusSessionEntity, UUID> {

  @Query(
      "select s from VersusSessionEntity s "
          + "where s.pool.id = :poolId and s.status = 'COMPLETED' "
          + "order by s.userId, s.completedAt desc")
  List<VersusSessionEntity> findCompletedByPoolOrderByUserAndCompletedAtDesc(
      @Param("poolId") UUID poolId);

  Optional<VersusSessionEntity> findByIdAndUserId(UUID id, UUID userId);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select s from VersusSessionEntity s where s.id = :id and s.userId = :userId")
  Optional<VersusSessionEntity> findByIdAndUserIdForUpdate(
      @Param("id") UUID id, @Param("userId") UUID userId);

  void deleteByPoolIdAndStatus(UUID poolId, VersusSessionStatus status);

  Optional<VersusSessionEntity> findFirstByPoolIdAndUserIdAndStatusOrderByCreatedAtDesc(
      UUID poolId, UUID userId, VersusSessionStatus status);

  @Query(
      "select s from VersusSessionEntity s "
          + "where s.pool.id = :poolId and s.status = 'COMPLETED' and s.userId in :userIds "
          + "order by s.userId, s.completedAt desc")
  List<VersusSessionEntity> findCompletedByPoolAndUsers(
      @Param("poolId") UUID poolId, @Param("userIds") Collection<UUID> userIds);
}
