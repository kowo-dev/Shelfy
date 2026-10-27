package com.shelfy.api.lists;

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

public interface MediaListRepository extends JpaRepository<MediaListEntity, UUID> {

  String IS_COLLABORATOR =
      "exists (select 1 from MediaListCollaboratorEntity c where c.list = content and"
          + " c.userId = :viewer and c.status ="
          + " com.shelfy.api.lists.ListCollaboratorStatus.ACCEPTED)";

  String LIST_VISIBLE = "(" + VisibilityJpql.CONTENT_VISIBLE + " or " + IS_COLLABORATOR + ")";

  String FROM_LISTS_WITH_OWNER =
      " from MediaListEntity content join UserEntity owner on owner.id = content.userId where ";

  String COMMUNITY_FILTER =
      " and (:q = '' or unaccent(lower(content.name)) like unaccent(:q) or "
          + CommunityJpql.OWNER_MATCHES
          + " or exists (select 1 from MediaListItemEntity qi where qi.list = content and"
          + " unaccent(lower(qi.media.title)) like unaccent(:q)))"
          + " and (:anyType = true or exists (select 1 from MediaListItemEntity ti where"
          + " ti.list = content and ti.media.mediaType in :types))"
          + " and (:mineOnly = false or owner.id = :viewer or "
          + IS_COLLABORATOR
          + ")"
          + CommunityJpql.CIRCLE_SCOPE
          + CommunityJpql.REMOTE_SCOPE;

  String BROWSE_WHERE =
      FROM_LISTS_WITH_OWNER
          + LIST_VISIBLE
          + " and "
          + VisibilityJpql.PROFILE_VISIBLE
          + COMMUNITY_FILTER;

  String OWNED_VISIBLE_NAMED =
      "content.userId = :ownerId and "
          + LIST_VISIBLE
          + " and (:q = '' or unaccent(lower(content.name)) like unaccent(:q))";

  List<MediaListEntity> findByUserIdOrderByUpdatedAtDesc(UUID userId);

  @Query(
      "select content from MediaListEntity content where content.userId = :viewer or "
          + IS_COLLABORATOR
          + " order by content.updatedAt desc")
  List<MediaListEntity> findEditableBy(@Param("viewer") UUID viewer, Pageable pageable);

  @Query(
      value =
          "select content"
              + BROWSE_WHERE
              + CommunityJpql.FAVORITES_FIRST
              + " case when :popular = true then (select count(l) from"
              + " MediaListLikeEntity l where l.list = content) else 0 end desc,"
              + " content.updatedAt desc, content.id desc",
      countQuery = "select count(content)" + BROWSE_WHERE)
  Page<MediaListEntity> search(
      @Param("viewer") UUID viewer,
      @Param("q") String q,
      @Param("anyType") boolean anyType,
      @Param("types") List<MediaType> types,
      @Param("mineOnly") boolean mineOnly,
      @Param("circleOnly") boolean circleOnly,
      @Param("remoteOnly") boolean remoteOnly,
      @Param("popular") boolean popular,
      Pageable pageable);

  default Page<MediaListEntity> browse(UUID viewer, CommunityFilter filter, Pageable pageable) {
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

  @Query(
      value = "select content" + FROM_LISTS_WITH_OWNER + OWNED_VISIBLE_NAMED,
      countQuery = "select count(content)" + FROM_LISTS_WITH_OWNER + OWNED_VISIBLE_NAMED)
  Page<MediaListEntity> findVisibleByOwner(
      @Param("ownerId") UUID ownerId,
      @Param("viewer") UUID viewer,
      @Param("q") String q,
      Pageable pageable);
}
