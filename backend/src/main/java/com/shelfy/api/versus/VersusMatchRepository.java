package com.shelfy.api.versus;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VersusMatchRepository extends JpaRepository<VersusMatchEntity, UUID> {

  List<VersusMatchEntity> findBySessionIdOrderByRoundAscSlotIndexAsc(UUID sessionId);

  @Query(
      "select m from VersusMatchEntity m "
          + "where m.session.id in :sessionIds and m.bye = false and m.winnerEntry is not null "
          + "and m.entryA is not null and m.entryB is not null")
  List<VersusMatchEntity> findDecidedNonByeMatchesBySessionIds(
      @Param("sessionIds") List<UUID> sessionIds);
}
