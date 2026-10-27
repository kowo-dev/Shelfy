package com.shelfy.api.follows;

import com.shelfy.api.common.IdCount;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FollowRepository extends JpaRepository<FollowEntity, FollowEntity.FollowId> {
  boolean existsByFollowerIdAndFollowedId(UUID followerId, UUID followedId);

  long countByFollowedId(UUID followedId);

  long countByFollowerId(UUID followerId);

  @Query(
      "select f.followedId as id, count(f) as count from FollowEntity f"
          + " where f.followedId in :ids group by f.followedId")
  List<IdCount> countFollowersByIds(@Param("ids") Collection<UUID> ids);

  Page<FollowEntity> findByFollowerIdAndFavoriteTrue(UUID followerId, Pageable pageable);

  @Query(
      "select f.followedId from FollowEntity f where f.followerId = :followerId and f.favorite = true")
  List<UUID> findFavoriteIds(@Param("followerId") UUID followerId);

  Page<FollowEntity> findByFollowerId(UUID followerId, Pageable pageable);

  List<FollowEntity> findByFollowerId(UUID followerId);

  List<FollowEntity> findByFollowedId(UUID followedId);

  Page<FollowEntity> findByFollowedId(UUID followedId, Pageable pageable);

  @Query(
      value =
          "select f from FollowEntity f, UserEntity u where u.id = f.followerId"
              + " and f.followedId = :followedId and (unaccent(lower(u.username)) like unaccent(:q)"
              + " or unaccent(lower(coalesce(u.displayName, ''))) like unaccent(:q))",
      countQuery =
          "select count(f) from FollowEntity f, UserEntity u where u.id = f.followerId"
              + " and f.followedId = :followedId and (unaccent(lower(u.username)) like unaccent(:q)"
              + " or unaccent(lower(coalesce(u.displayName, ''))) like unaccent(:q))")
  Page<FollowEntity> searchFollowers(
      @Param("followedId") UUID followedId, @Param("q") String q, Pageable pageable);

  @Query(
      """
      select f.followedId from FollowEntity f join UserEntity u on u.id = f.followedId
      where f.followerId = :followerId
        and u.profileVisibility = com.shelfy.api.auth.CollectionVisibility.PUBLIC
      """)
  List<UUID> findPublicFollowedIds(@Param("followerId") UUID followerId);

  @Query(
      value =
          """
          select u.id as id, count(f.followerId) as followers
          from UserEntity u
          left join FollowEntity f on f.followedId = u.id
          where u.id <> :viewer
            and u.domain is null
            and u.profileVisibility = com.shelfy.api.auth.CollectionVisibility.PUBLIC
            and not exists (
              select 1 from FollowEntity mine
              where mine.followerId = :viewer and mine.followedId = u.id)
            and exists (
              select 1 from UserActivityEntity a
              where a.userId = u.id and a.createdAt >= :activeSince)
          group by u.id, u.username
          order by count(f.followerId) desc, u.username asc
          """,
      countQuery =
          """
          select count(u) from UserEntity u
          where u.id <> :viewer
            and u.domain is null
            and u.profileVisibility = com.shelfy.api.auth.CollectionVisibility.PUBLIC
            and not exists (
              select 1 from FollowEntity mine
              where mine.followerId = :viewer and mine.followedId = u.id)
            and exists (
              select 1 from UserActivityEntity a
              where a.userId = u.id and a.createdAt >= :activeSince)
          """)
  Page<PopularUserRow> findPopular(
      @Param("viewer") UUID viewer, @Param("activeSince") Instant activeSince, Pageable pageable);

  interface PopularUserRow {
    UUID getId();

    long getFollowers();
  }
}
