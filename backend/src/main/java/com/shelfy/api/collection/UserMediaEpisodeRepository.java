package com.shelfy.api.collection;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserMediaEpisodeRepository extends JpaRepository<UserMediaEpisodeEntity, UUID> {

  List<UserMediaEpisodeEntity> findByUserMediaId(UUID userMediaId);

  Optional<UserMediaEpisodeEntity> findByUserMediaIdAndSeasonAndEpisode(
      UUID userMediaId, int season, int episode);

  int POSITION_BASE = 100_000;

  @Query(
      "select e.userMedia.id as userMediaId, count(e) as watched,"
          + " max(e.season * "
          + POSITION_BASE
          + " + e.episode) as lastPosition"
          + " from UserMediaEpisodeEntity e"
          + " where e.userMedia.id in :ids and e.season > 0 group by e.userMedia.id")
  List<EpisodeSummaryRow> summarize(@Param("ids") Collection<UUID> ids);

  interface EpisodeSummaryRow {
    UUID getUserMediaId();

    long getWatched();

    int getLastPosition();
  }

  @Query(
      """
      select e.season as season, e.episode as episode,
        avg(e.rating) as average, count(e.rating) as votes
      from UserMediaEpisodeEntity e
      join e.userMedia um
      join um.media m
      join UserEntity u on u.id = um.userId
      where m.provider = :provider
      and m.mediaType = :mediaType
      and m.externalId = :externalId
      and e.rating is not null
      and um.userId <> :viewerId
      and u.profileVisibility = com.shelfy.api.auth.CollectionVisibility.PUBLIC
      group by e.season, e.episode
      """)
  List<EpisodeAverageRow> communityAverages(
      @Param("viewerId") UUID viewerId,
      @Param("provider") String provider,
      @Param("mediaType") MediaType mediaType,
      @Param("externalId") String externalId);

  @Query(
      """
      select e from UserMediaEpisodeEntity e
      join fetch e.userMedia um
      join um.media m
      join UserEntity u on u.id = um.userId
      where m.provider = :provider
      and m.mediaType = :mediaType
      and m.externalId = :externalId
      and e.rating is not null
      and u.profileVisibility = com.shelfy.api.auth.CollectionVisibility.PUBLIC
      and exists (
        select 1 from FollowEntity f
        where f.followerId = :viewerId and f.followedId = um.userId
      )
      """)
  List<UserMediaEpisodeEntity> followedRatings(
      @Param("viewerId") UUID viewerId,
      @Param("provider") String provider,
      @Param("mediaType") MediaType mediaType,
      @Param("externalId") String externalId);

  interface EpisodeAverageRow {
    int getSeason();

    int getEpisode();

    double getAverage();

    long getVotes();
  }
}
