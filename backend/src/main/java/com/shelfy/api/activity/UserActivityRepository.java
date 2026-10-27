package com.shelfy.api.activity;

import com.shelfy.api.community.CommunityJpql;
import com.shelfy.api.people.VisibilityJpql;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserActivityRepository extends JpaRepository<UserActivityEntity, UUID> {

  String CIRCLE_FEED =
      " from UserActivityEntity a join UserEntity owner on owner.id = a.userId"
          + " where owner.id <> :viewer and "
          + CommunityJpql.OWNER_IN_CIRCLE
          + " and "
          + VisibilityJpql.PROFILE_VISIBLE
          + " and a.activityType in :types";

  @Query(
      "select a" + CIRCLE_FEED + " and a.createdAt < :before order by a.createdAt desc, a.id desc")
  List<UserActivityEntity> findCircleFeed(
      @Param("viewer") UUID viewer,
      @Param("types") List<ActivityType> types,
      @Param("before") Instant before,
      Pageable pageable);

  @Query("select count(a)" + CIRCLE_FEED + " and a.createdAt > :since")
  long countCircleFeedSince(
      @Param("viewer") UUID viewer,
      @Param("types") List<ActivityType> types,
      @Param("since") Instant since);

  Page<UserActivityEntity> findByUserId(UUID userId, Pageable pageable);

  Optional<UserActivityEntity>
      findFirstByUserMedia_IdAndActivityTypeAndCreatedAtAfterOrderByCreatedAtDesc(
          UUID userMediaId, ActivityType activityType, Instant after);

  List<UserActivityEntity> findByUserMedia_IdIn(List<UUID> userMediaIds);

  long countByUserIdAndActivityTypeIn(UUID userId, Collection<ActivityType> types);

  List<UserActivityEntity> findByUserIdAndActivityTypeInOrderByCreatedAtDesc(
      UUID userId, Collection<ActivityType> types, Pageable pageable);

  void deleteByUserMedia_IdIn(List<UUID> userMediaIds);
}
