package com.shelfy.api.collection;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.collection.UserMediaEpisodeRepository.EpisodeAverageRow;
import com.shelfy.api.follows.FollowEntity;
import com.shelfy.api.follows.FollowRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class SocialEpisodeQueriesIntegrationTest {

  @Autowired private UserRepository users;
  @Autowired private FollowRepository follows;
  @Autowired private CanonicalWorkRepository works;
  @Autowired private MediaRepository medias;
  @Autowired private UserMediaRepository userMedias;
  @Autowired private UserMediaEpisodeRepository episodes;

  @Test
  void followedItemsOnMedia_keepsPublicPeopleTheViewerFollows() {
    UserEntity viewer = user(CollectionVisibility.PUBLIC);
    UserEntity friend = user(CollectionVisibility.PUBLIC);
    UserEntity privateFriend = user(CollectionVisibility.PRIVATE);
    UserEntity stranger = user(CollectionVisibility.PUBLIC);
    follow(viewer, friend);
    follow(viewer, privateFriend);
    follow(stranger, viewer);
    MediaEntity show = media();
    for (UserEntity holder : List.of(viewer, friend, privateFriend, stranger)) {
      item(holder, show);
    }

    List<UserMediaEntity> found =
        userMedias.findFollowedItemsOnMedia(
            viewer.getId(), show.getProvider(), show.getMediaType(), show.getExternalId());

    assertEquals(List.of(friend.getId()), found.stream().map(UserMediaEntity::getUserId).toList());
  }

  @Test
  void communityAverages_leaveOutTheViewerAndPrivateProfiles() {
    UserEntity viewer = user(CollectionVisibility.PUBLIC);
    UserEntity first = user(CollectionVisibility.PUBLIC);
    UserEntity second = user(CollectionVisibility.PUBLIC);
    UserEntity hidden = user(CollectionVisibility.PRIVATE);
    follow(viewer, second);
    MediaEntity show = media();
    rate(item(viewer, show), 1, 1);
    rate(item(first, show), 1, 8);
    rate(item(second, show), 1, 6);
    rate(item(hidden, show), 1, 10);

    List<EpisodeAverageRow> averages =
        episodes.communityAverages(
            viewer.getId(), show.getProvider(), show.getMediaType(), show.getExternalId());
    List<UserMediaEpisodeEntity> friends =
        episodes.followedRatings(
            viewer.getId(), show.getProvider(), show.getMediaType(), show.getExternalId());

    assertEquals(1, averages.size());
    assertEquals(7.0, averages.getFirst().getAverage());
    assertEquals(2, averages.getFirst().getVotes());
    assertEquals(
        List.of(second.getId()), friends.stream().map(e -> e.getUserMedia().getUserId()).toList());
  }

  private UserEntity user(CollectionVisibility visibility) {
    String name = "u" + UUID.randomUUID().toString().substring(0, 12);
    UserEntity user = new UserEntity(name + "@example.com", name, "hash");
    user.setProfileVisibility(visibility);
    return users.saveAndFlush(user);
  }

  private void follow(UserEntity follower, UserEntity followed) {
    follows.saveAndFlush(new FollowEntity(follower.getId(), followed.getId()));
  }

  private MediaEntity media() {
    CanonicalWorkEntity work = works.saveAndFlush(new CanonicalWorkEntity(MediaType.TV_SHOW));
    return medias.saveAndFlush(
        new MediaEntity(
            UUID.randomUUID().toString(),
            "tmdb",
            MediaType.TV_SHOW,
            work,
            "Title",
            null,
            Map.of(),
            false));
  }

  private UserMediaEntity item(UserEntity owner, MediaEntity media) {
    return userMedias.saveAndFlush(
        new UserMediaEntity(owner.getId(), media, UserMediaStatus.ONGOING, null, Map.of()));
  }

  private void rate(UserMediaEntity item, int episode, int rating) {
    UserMediaEpisodeEntity entity = new UserMediaEpisodeEntity(item, 1, episode);
    entity.setRating(rating);
    episodes.saveAndFlush(entity);
  }
}
