package com.shelfy.api.collection;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WatchLogRepository extends JpaRepository<WatchLogEntity, UUID> {

  List<WatchLogEntity> findByUserMediaIdOrderByOccurredAtAsc(UUID userMediaId);

  List<WatchLogEntity> findByUserMediaUserIdOrderByOccurredAtAsc(UUID userId);

  List<WatchLogEntity> findByUserMediaIdOrderByOccurredAtDescCreatedAtDesc(UUID userMediaId);

  Optional<WatchLogEntity> findByIdAndUserMediaId(UUID id, UUID userMediaId);

  @Query(
      "select w.userMedia.id, count(w) from WatchLogEntity w"
          + " where w.userMedia.id in :ids group by w.userMedia.id")
  List<Object[]> countByUserMediaIds(@Param("ids") Collection<UUID> ids);
}
