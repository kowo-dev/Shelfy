package com.shelfy.api.lists;

import com.shelfy.api.common.IdCount;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MediaListLikeRepository extends JpaRepository<MediaListLikeEntity, UUID> {
  boolean existsByListIdAndUserId(UUID listId, UUID userId);

  long countByListId(UUID listId);

  void deleteByListIdAndUserId(UUID listId, UUID userId);

  @Query(
      "select l.list.id as id, count(l) as count from MediaListLikeEntity l"
          + " where l.list.id in :ids group by l.list.id")
  List<IdCount> countByListIds(@Param("ids") Collection<UUID> ids);
}
