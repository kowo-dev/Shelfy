package com.shelfy.api.versus;

import com.shelfy.api.collection.MediaType;
import com.shelfy.api.community.CommunityFilter;
import com.shelfy.api.community.CommunityJpql;
import com.shelfy.api.people.VisibilityJpql;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VersusPoolRepository extends JpaRepository<VersusPoolEntity, UUID> {

  String BROWSE_WHERE =
      " from VersusPoolEntity content join UserEntity owner on owner.id = content.userId where "
          + VisibilityJpql.CONTENT_VISIBLE
          + " and "
          + VisibilityJpql.PROFILE_VISIBLE
          + " and (:q = '' or unaccent(lower(content.name)) like unaccent(:q) or "
          + CommunityJpql.OWNER_MATCHES
          + " or exists (select 1 from VersusPoolItemEntity qi join qi.media qm where"
          + " qi.pool = content and unaccent(lower(qm.title)) like unaccent(:q)))"
          + " and (:anyType = true or exists (select 1 from VersusPoolItemEntity ti join"
          + " ti.media tm where ti.pool = content and tm.mediaType in :types))"
          + " and (:mineOnly = false or owner.id = :viewer)"
          + CommunityJpql.CIRCLE_SCOPE
          + CommunityJpql.REMOTE_SCOPE;

  String FROM_POOLS_WITH_OWNER =
      " from VersusPoolEntity content join UserEntity owner on owner.id = content.userId where"
          + " content.userId = :ownerId and ("
          + VisibilityJpql.CONTENT_VISIBLE
          + " or exists (select 1 from VersusPoolCollaboratorEntity c where c.pool = content and"
          + " c.userId = :viewer and c.status ="
          + " com.shelfy.api.lists.ListCollaboratorStatus.ACCEPTED))"
          + " and (:q = '' or unaccent(lower(content.name)) like unaccent(:q))";

  @Query(
      value = "select content" + FROM_POOLS_WITH_OWNER,
      countQuery = "select count(content)" + FROM_POOLS_WITH_OWNER)
  Page<VersusPoolEntity> findVisibleByOwner(
      @Param("ownerId") UUID ownerId,
      @Param("viewer") UUID viewer,
      @Param("q") String q,
      Pageable pageable);

  @Query(
      "select content from VersusPoolEntity content where content.userId = :viewer or exists"
          + " (select 1 from VersusPoolCollaboratorEntity c where c.pool = content and"
          + " c.userId = :viewer and c.status ="
          + " com.shelfy.api.lists.ListCollaboratorStatus.ACCEPTED)"
          + " order by content.updatedAt desc")
  List<VersusPoolEntity> findEditableBy(@Param("viewer") UUID viewer, Pageable pageable);

  @Query(
      value =
          "select content"
              + BROWSE_WHERE
              + " order by case when :popular = true then (select count(l) from"
              + " VersusPoolLikeEntity l where l.pool = content) else 0 end desc,"
              + " content.updatedAt desc, content.id desc",
      countQuery = "select count(content)" + BROWSE_WHERE)
  Page<VersusPoolEntity> search(
      @Param("viewer") UUID viewer,
      @Param("q") String q,
      @Param("anyType") boolean anyType,
      @Param("types") List<MediaType> types,
      @Param("mineOnly") boolean mineOnly,
      @Param("circleOnly") boolean circleOnly,
      @Param("remoteOnly") boolean remoteOnly,
      @Param("popular") boolean popular,
      Pageable pageable);

  default Page<VersusPoolEntity> browse(UUID viewer, CommunityFilter filter, Pageable pageable) {
    return search(
        viewer,
        filter.likePattern(),
        filter.anyType(),
        filter.types(),
        filter.mineOnly(),
        filter.circleOnly(),
        filter.remoteOnly(),
        filter.popular(),
        pageable);
  }

  List<VersusPoolEntity> findByUserIdOrderByCreatedAtAsc(UUID userId);
}
