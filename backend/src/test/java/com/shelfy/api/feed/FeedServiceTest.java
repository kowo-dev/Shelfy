package com.shelfy.api.feed;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.shelfy.api.activity.ActivityType;
import com.shelfy.api.activity.UserActivityEntity;
import com.shelfy.api.activity.UserActivityRepository;
import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.collection.CanonicalWorkEntity;
import com.shelfy.api.collection.CanonicalWorkRepository;
import com.shelfy.api.collection.MediaEntity;
import com.shelfy.api.collection.MediaRepository;
import com.shelfy.api.collection.MediaType;
import com.shelfy.api.collection.UserMediaEntity;
import com.shelfy.api.collection.UserMediaRepository;
import com.shelfy.api.collection.UserMediaStatus;
import com.shelfy.api.community.CommunityFilter;
import com.shelfy.api.community.CommunityScope;
import com.shelfy.api.community.CommunitySort;
import com.shelfy.api.feed.dto.FeedItemDto;
import com.shelfy.api.feed.dto.FeedPageResponseDto;
import com.shelfy.api.follows.FollowEntity;
import com.shelfy.api.follows.FollowRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class FeedServiceTest {

  @Autowired private FeedService feed;
  @Autowired private UserActivityRepository activities;
  @Autowired private UserRepository users;
  @Autowired private FollowRepository follows;
  @Autowired private CanonicalWorkRepository works;
  @Autowired private MediaRepository medias;
  @Autowired private UserMediaRepository userMedias;

  private UserEntity viewer;
  private UserEntity friend;
  private UserEntity followed;
  private UserEntity hiddenFollowed;
  private UserEntity stranger;

  @BeforeEach
  void setUp() {
    viewer = user(CollectionVisibility.PUBLIC);
    friend = user(CollectionVisibility.PUBLIC);
    followed = user(CollectionVisibility.PUBLIC);
    hiddenFollowed = user(CollectionVisibility.PRIVATE);
    stranger = user(CollectionVisibility.PUBLIC);
    follows.saveAndFlush(new FollowEntity(viewer.getId(), friend.getId()));
    follows.saveAndFlush(new FollowEntity(viewer.getId(), followed.getId()));
    follows.saveAndFlush(new FollowEntity(viewer.getId(), hiddenFollowed.getId()));
  }

  @Test
  void circleFeedShowsVisibleFriendsAndFollowsNewestFirst() {
    activity(viewer, ActivityType.RATED);
    activity(stranger, ActivityType.RATED);
    activity(hiddenFollowed, ActivityType.RATED);
    activity(friend, ActivityType.COMMENTED);
    UserActivityEntity fromFriend = activity(friend, ActivityType.RATED);
    UserActivityEntity fromFollowed = activity(followed, ActivityType.REVIEWED);

    FeedPageResponseDto page = feed.getCircleFeed(viewer.getId(), null, 20);

    assertEquals(
        List.of(fromFollowed.getId(), fromFriend.getId()),
        page.items().stream().map(FeedItemDto::id).toList());
    assertEquals(followed.getUsername(), page.items().getFirst().actor().username());
    assertNotNull(page.items().getFirst().reviewId());
    assertNull(page.nextBefore());
  }

  @Test
  void cursorPagesAndUnreadCountsNewerItems() {
    UserActivityEntity older = activity(friend, ActivityType.ADDED);
    Instant seen = Instant.now();
    pause();
    activity(followed, ActivityType.ADDED);
    activity(friend, ActivityType.RATED);

    FeedPageResponseDto first = feed.getCircleFeed(viewer.getId(), null, 2);
    FeedPageResponseDto second = feed.getCircleFeed(viewer.getId(), first.nextBefore(), 2);

    assertEquals(2, first.items().size());
    assertEquals(List.of(older.getId()), second.items().stream().map(FeedItemDto::id).toList());
    assertEquals(2, feed.getUnread(viewer.getId(), seen).count());
  }

  @Test
  void reviewSearchMatchesTitleAndScope() {
    UserMediaEntity review = activity(friend, ActivityType.REVIEWED).getUserMedia();
    activity(stranger, ActivityType.REVIEWED);
    var filter =
        new CommunityFilter(
            review.getMedia().getTitle(), CommunityScope.CIRCLE, null, CommunitySort.POPULAR);

    var page = userMedias.browseReviews(viewer.getId(), filter, PageRequest.of(0, 10));

    assertEquals(List.of(review.getId()), page.getContent().stream().map(r -> r.getId()).toList());
  }

  private UserActivityEntity activity(UserEntity owner, ActivityType type) {
    CanonicalWorkEntity work = works.saveAndFlush(new CanonicalWorkEntity(MediaType.MOVIE));
    MediaEntity media =
        medias.saveAndFlush(
            new MediaEntity(
                UUID.randomUUID().toString(),
                "test",
                MediaType.MOVIE,
                work,
                "Film " + UUID.randomUUID(),
                null,
                Map.of(),
                false));
    UserMediaEntity item =
        new UserMediaEntity(owner.getId(), media, UserMediaStatus.DONE, 8, Map.of());
    if (type == ActivityType.REVIEWED) {
      item.setNote(Map.of("type", "doc"));
    }
    UserMediaEntity saved = userMedias.saveAndFlush(item);
    UserActivityEntity activity =
        activities.saveAndFlush(new UserActivityEntity(owner.getId(), saved, type, Map.of()));
    pause();
    return activity;
  }

  private UserEntity user(CollectionVisibility visibility) {
    String name = "f" + UUID.randomUUID().toString().substring(0, 12);
    UserEntity user = new UserEntity(name + "@example.com", name, "hash");
    user.setProfileVisibility(visibility);
    return users.saveAndFlush(user);
  }

  private void pause() {
    try {
      Thread.sleep(5);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
