package com.shelfy.api.collection;

import com.shelfy.api.common.IdCount;
import com.shelfy.api.community.CommunityFilter;
import com.shelfy.api.community.CommunityJpql;
import com.shelfy.api.people.VisibilityJpql;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserMediaRepository extends JpaRepository<UserMediaEntity, UUID> {

  String FILTERED_ITEMS =
      """
      where um.userId = :userId
      and (:statuses is null or um.status in :statuses)
      and (:mediaTypes is null or m.mediaType in :mediaTypes)
      and (
        (:includeUnrated = true and um.rating is null)
        or (
          um.rating is not null
          and (:minRating is null or um.rating >= :minRating)
          and (:maxRating is null or um.rating <= :maxRating)
        )
      )
      and (:search is null or unaccent(lower(m.title)) like unaccent(lower(concat('%', cast(:search as string), '%'))))
      and (:includeAdult = true or m.adult = false)
      and (:withNote = false or um.note is not null)
      """;

  String COMMON_WITH_VIEWER =
      """
      and exists (
        select 1 from UserMediaEntity mine
        where mine.userId = :viewerId
        and mine.media.canonicalWork.id = m.canonicalWork.id
      )
      """;

  @Query(
      value = "select um from UserMediaEntity um join fetch um.media m " + FILTERED_ITEMS,
      countQuery = "select count(um) from UserMediaEntity um join um.media m " + FILTERED_ITEMS)
  Page<UserMediaEntity> findByUserIdAndFilters(
      @Param("userId") UUID userId,
      @Param("statuses") List<UserMediaStatus> statuses,
      @Param("mediaTypes") List<MediaType> mediaTypes,
      @Param("includeUnrated") boolean includeUnrated,
      @Param("minRating") Integer minRating,
      @Param("maxRating") Integer maxRating,
      @Param("search") String search,
      @Param("includeAdult") boolean includeAdult,
      @Param("withNote") boolean withNote,
      Pageable pageable);

  @Query(
      value =
          "select um from UserMediaEntity um join fetch um.media m "
              + FILTERED_ITEMS
              + COMMON_WITH_VIEWER,
      countQuery =
          "select count(um) from UserMediaEntity um join um.media m "
              + FILTERED_ITEMS
              + COMMON_WITH_VIEWER)
  Page<UserMediaEntity> findCommonByUserIdAndFilters(
      @Param("viewerId") UUID viewerId,
      @Param("userId") UUID userId,
      @Param("statuses") List<UserMediaStatus> statuses,
      @Param("mediaTypes") List<MediaType> mediaTypes,
      @Param("includeUnrated") boolean includeUnrated,
      @Param("minRating") Integer minRating,
      @Param("maxRating") Integer maxRating,
      @Param("search") String search,
      @Param("includeAdult") boolean includeAdult,
      @Param("withNote") boolean withNote,
      Pageable pageable);

  @Query(
      "select um from UserMediaEntity um join fetch um.media m where um.userId = :userId "
          + "and m.canonicalWork.id in :canonicalWorkIds")
  List<UserMediaEntity> findByUserIdAndCanonicalWorkIdIn(
      @Param("userId") UUID userId, @Param("canonicalWorkIds") List<UUID> canonicalWorkIds);

  String COMMON_PAIRS =
      """
      from UserMediaEntity um join um.media m, UserMediaEntity mine
      where um.userId = :targetId
      and mine.userId = :viewerId
      and mine.media.canonicalWork.id = m.canonicalWork.id
      and (:includeAdult = true or m.adult = false)
      """;

  @Query("select count(distinct m.canonicalWork.id) " + COMMON_PAIRS)
  long countCommon(
      @Param("viewerId") UUID viewerId,
      @Param("targetId") UUID targetId,
      @Param("includeAdult") boolean includeAdult);

  @Query(
      "select avg(abs(um.rating - mine.rating)) "
          + COMMON_PAIRS
          + " and um.rating is not null and mine.rating is not null")
  Double averageRatingGap(
      @Param("viewerId") UUID viewerId,
      @Param("targetId") UUID targetId,
      @Param("includeAdult") boolean includeAdult);

  @Query(
      "select m, um.rating, mine.rating "
          + COMMON_PAIRS
          + " and um.rating >= :threshold and mine.rating >= :threshold"
          + " order by abs(um.rating - mine.rating) asc, (um.rating + mine.rating) desc,"
          + " m.title asc, m.id asc")
  List<Object[]> findBothLoved(
      @Param("viewerId") UUID viewerId,
      @Param("targetId") UUID targetId,
      @Param("includeAdult") boolean includeAdult,
      @Param("threshold") int threshold,
      Pageable pageable);

  Optional<UserMediaEntity> findByIdAndUserId(UUID id, UUID userId);

  @Query(
      "select um from UserMediaEntity um join fetch um.media where um.id = :id and um.userId = :userId")
  Optional<UserMediaEntity> findWithMediaByIdAndUserId(
      @Param("id") UUID id, @Param("userId") UUID userId);

  @Query("select um from UserMediaEntity um join fetch um.media where um.userId = :userId")
  List<UserMediaEntity> findAllByUserId(@Param("userId") UUID userId);

  @Query(
      "select um from UserMediaEntity um join fetch um.media where um.userId = :userId "
          + "and um.status = :status order by um.updatedAt desc")
  List<UserMediaEntity> findByUserIdAndStatusOrderByUpdatedAtDesc(
      @Param("userId") UUID userId, @Param("status") UserMediaStatus status, Pageable pageable);

  @Query(
      "select um from UserMediaEntity um join fetch um.media where um.id in :ids and um.userId = :userId")
  List<UserMediaEntity> findByIdInAndUserId(
      @Param("ids") List<UUID> ids, @Param("userId") UUID userId);

  Optional<UserMediaEntity> findByUserIdAndMediaId(UUID userId, UUID mediaId);

  @Query(
      """
      select um from UserMediaEntity um
      join um.media m
      join UserEntity u on u.id = um.userId
      where m.provider = :provider
      and m.mediaType = :mediaType
      and m.externalId = :externalId
      and u.profileVisibility = com.shelfy.api.auth.CollectionVisibility.PUBLIC
      and exists (
        select 1 from FollowEntity f
        where f.followerId = :viewerId and f.followedId = um.userId
      )
      order by um.updatedAt desc
      """)
  List<UserMediaEntity> findFollowedItemsOnMedia(
      @Param("viewerId") UUID viewerId,
      @Param("provider") String provider,
      @Param("mediaType") MediaType mediaType,
      @Param("externalId") String externalId);

  String USER_REVIEWS =
      " from UserMediaEntity um where um.userId = :userId and um.note is not null"
          + " and (:q = '' or unaccent(lower(um.media.title)) like unaccent(:q))";

  @Query(value = "select um" + USER_REVIEWS, countQuery = "select count(um)" + USER_REVIEWS)
  Page<UserMediaEntity> findReviewsByUser(
      @Param("userId") UUID userId, @Param("q") String q, Pageable pageable);

  String VISIBLE_REVIEWS =
      " from UserMediaEntity um join UserEntity owner on owner.id = um.userId"
          + " where um.note is not null and "
          + VisibilityJpql.PROFILE_VISIBLE;

  String BROWSE_REVIEWS =
      VISIBLE_REVIEWS
          + " and (:q = '' or unaccent(lower(um.media.title)) like unaccent(:q) or "
          + CommunityJpql.OWNER_MATCHES
          + ")"
          + " and um.media.mediaType in :types"
          + " and (:mineOnly = false or owner.id = :viewer)"
          + CommunityJpql.CIRCLE_SCOPE
          + CommunityJpql.REMOTE_SCOPE;

  @Query(
      value =
          "select um"
              + BROWSE_REVIEWS
              + CommunityJpql.FAVORITES_FIRST
              + " case when :popular = true then (select count(l) from"
              + " ReviewLikeEntity l where l.review = um) else 0 end desc,"
              + " um.updatedAt desc, um.id desc",
      countQuery = "select count(um)" + BROWSE_REVIEWS)
  Page<UserMediaEntity> searchReviews(
      @Param("viewer") UUID viewer,
      @Param("q") String q,
      @Param("types") List<MediaType> types,
      @Param("mineOnly") boolean mineOnly,
      @Param("circleOnly") boolean circleOnly,
      @Param("remoteOnly") boolean remoteOnly,
      @Param("popular") boolean popular,
      Pageable pageable);

  default Page<UserMediaEntity> browseReviews(
      UUID viewer, CommunityFilter filter, Pageable pageable) {
    return searchReviews(
        viewer,
        filter.likePattern(),
        filter.types(),
        filter.mineOnly(),
        filter.circleOnly(),
        filter.remoteOnly(),
        filter.popular(),
        pageable);
  }

  @Query("select um" + VISIBLE_REVIEWS + " and um.media.id = :mediaId order by um.updatedAt desc")
  List<UserMediaEntity> findVisibleReviewsOfMedia(
      @Param("mediaId") UUID mediaId, @Param("viewer") UUID viewer, Pageable pageable);

  boolean existsByUserIdAndMediaId(UUID userId, UUID mediaId);

  long countByUserId(UUID userId);

  @Query(
      "select um.userId as id, count(um) as count from UserMediaEntity um"
          + " where um.userId in :userIds group by um.userId")
  List<IdCount> countByUserIds(@Param("userIds") Collection<UUID> userIds);

  @Query(
      value =
          """
          select t.user_id as userId, t.cover_url as coverUrl from (
            select um.user_id, m.cover_url,
              row_number() over (
                partition by um.user_id order by um.created_at desc, um.id
              ) as rn
            from user_media um join media m on m.id = um.media_id
            where um.user_id in (:userIds)
            and m.cover_url is not null and m.cover_url <> ''
            and m.media_type <> 'BOOK'
            and (:includeAdult = true or m.is_adult = false)
          ) t
          where t.rn <= :perUser
          order by t.user_id, t.rn
          """,
      nativeQuery = true)
  List<LatestCover> findLatestCovers(
      @Param("userIds") Collection<UUID> userIds,
      @Param("perUser") int perUser,
      @Param("includeAdult") boolean includeAdult);

  interface LatestCover {
    UUID getUserId();

    String getCoverUrl();
  }

  long countByUserIdAndStatus(UUID userId, UserMediaStatus status);

  long countByUserIdAndNoteIsNotNull(UUID userId);

  @Query(
      "select avg(um.rating) from UserMediaEntity um where um.userId = :userId and um.rating is not null")
  Double findAverageRatingByUserId(@Param("userId") UUID userId);

  @Query(
      """
      select um.media.mediaType as mediaType, um.status as status, count(um) as count
      from UserMediaEntity um
      where um.userId = :userId
      group by um.media.mediaType, um.status
      """)
  List<MediaTypeStatusCount> countByUserIdGroupByMediaTypeAndStatus(@Param("userId") UUID userId);

  @Query(
      """
      select avg(um.rating) from UserMediaEntity um
      where um.userId = :userId and um.rating is not null
      """)
  Double findAverageRating(@Param("userId") UUID userId);

  interface MediaTypeStatusCount {
    MediaType getMediaType();

    UserMediaStatus getStatus();

    Long getCount();
  }

  @Query(
      "select um from UserMediaEntity um join fetch um.media where um.userId = :userId and um.media.id in :mediaIds")
  List<UserMediaEntity> findByUserIdAndMediaIdIn(
      @Param("userId") UUID userId, @Param("mediaIds") List<UUID> mediaIds);

  @Query("select um.media.id from UserMediaEntity um where um.userId = :userId")
  List<UUID> findMediaIdsByUserId(@Param("userId") UUID userId);

  @Modifying
  @Query("delete from UserMediaEntity um where um.userId = :userId")
  void deleteAllByUserId(@Param("userId") UUID userId);
}
