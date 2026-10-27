package com.shelfy.api.lists;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.collection.CanonicalWorkEntity;
import com.shelfy.api.collection.CanonicalWorkRepository;
import com.shelfy.api.collection.MediaEntity;
import com.shelfy.api.collection.MediaRepository;
import com.shelfy.api.collection.MediaType;
import com.shelfy.api.community.CommunityFilter;
import com.shelfy.api.community.CommunityScope;
import com.shelfy.api.community.CommunitySort;
import com.shelfy.api.follows.FollowEntity;
import com.shelfy.api.follows.FollowRepository;
import java.util.LinkedHashSet;
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
class MediaListSearchTest {

  @Autowired private MediaListRepository lists;
  @Autowired private MediaListLikeRepository likes;
  @Autowired private UserRepository users;
  @Autowired private FollowRepository follows;
  @Autowired private CanonicalWorkRepository works;
  @Autowired private MediaRepository medias;

  private final String marker = UUID.randomUUID().toString().substring(0, 8);
  private UserEntity viewer;
  private UserEntity friend;
  private UserEntity followed;
  private UserEntity stranger;
  private MediaListEntity mine;
  private MediaListEntity ofFriend;
  private MediaListEntity ofFollowed;
  private MediaListEntity ofStranger;

  @BeforeEach
  void setUp() {
    viewer = user("viewer");
    friend = user("friend");
    followed = user("followed");
    stranger = user("stranger");
    follows.saveAndFlush(new FollowEntity(viewer.getId(), friend.getId()));
    follows.saveAndFlush(new FollowEntity(viewer.getId(), followed.getId()));

    mine = list(viewer, "Mine " + marker, media(MediaType.BOOK, "Dune"));
    ofFriend = list(friend, "Huis clos " + marker, media(MediaType.MOVIE, "Rope"));
    ofFollowed = list(followed, "Games " + marker, media(MediaType.GAME, "Outer Wilds"));
    ofStranger = list(stranger, "Desert " + marker, media(MediaType.MOVIE, "Dune Part Two"));
  }

  @Test
  void queryMatchesListNameOwnerAndContainedTitles() {
    assertEquals(List.of(ofFriend.getId()), ids(filter("huis clos", CommunityScope.ALL, null)));
    assertEquals(
        List.of(ofStranger.getId(), mine.getId()), ids(filter("dune", CommunityScope.ALL, null)));
    assertEquals(
        List.of(ofFollowed.getId()), ids(filter(followed.getUsername(), CommunityScope.ALL, null)));
  }

  @Test
  void scopesNarrowToCircleOrMine() {
    assertEquals(
        List.of(ofFollowed.getId(), ofFriend.getId()),
        ids(filter(marker, CommunityScope.CIRCLE, null)));
    assertEquals(List.of(mine.getId()), ids(filter(marker, CommunityScope.MINE, null)));
  }

  @Test
  void fediverseScopeKeepsOnlyListsOfAccountsOnOtherServers() {
    UserEntity remote = user("remote");
    remote.setDomain("other.example");
    users.saveAndFlush(remote);
    MediaListEntity ofRemote = list(remote, "Elsewhere " + marker, media(MediaType.MOVIE, "Heat"));

    assertEquals(List.of(ofRemote.getId()), ids(filter(marker, CommunityScope.REMOTE, null)));
    assertTrue(ids(filter(marker, CommunityScope.ALL, null)).contains(ofRemote.getId()));
  }

  @Test
  void mediaTypeKeepsListsContainingThatMedium() {
    assertEquals(
        List.of(ofStranger.getId(), ofFriend.getId()),
        ids(filter(marker, CommunityScope.ALL, MediaType.MOVIE)));
  }

  @Test
  void popularSortOrdersByLikes() {
    likes.saveAndFlush(new MediaListLikeEntity(ofFriend, viewer.getId()));
    likes.saveAndFlush(new MediaListLikeEntity(ofFriend, stranger.getId()));
    likes.saveAndFlush(new MediaListLikeEntity(mine, friend.getId()));
    var popular = new CommunityFilter(marker, CommunityScope.ALL, null, CommunitySort.POPULAR);
    List<UUID> ordered = ids(popular);
    assertEquals(List.of(ofFriend.getId(), mine.getId()), ordered.subList(0, 2));
  }

  private CommunityFilter filter(String q, CommunityScope scope, MediaType type) {
    return new CommunityFilter(q, scope, type, CommunitySort.RECENT);
  }

  private List<UUID> ids(CommunityFilter filter) {
    return lists.browse(viewer.getId(), filter, PageRequest.of(0, 50)).getContent().stream()
        .map(MediaListEntity::getId)
        .toList();
  }

  private UserEntity user(String prefix) {
    String name = prefix + UUID.randomUUID().toString().substring(0, 8);
    UserEntity user = new UserEntity(name + "@example.com", name, "hash");
    user.setProfileVisibility(CollectionVisibility.PUBLIC);
    return users.saveAndFlush(user);
  }

  private MediaEntity media(MediaType type, String title) {
    CanonicalWorkEntity work = works.saveAndFlush(new CanonicalWorkEntity(type));
    return medias.saveAndFlush(
        new MediaEntity(
            UUID.randomUUID().toString(), "test", type, work, title, null, Map.of(), false));
  }

  private MediaListEntity list(UserEntity owner, String name, MediaEntity media) {
    MediaListEntity list =
        new MediaListEntity(
            owner.getId(), name, null, CollectionVisibility.PUBLIC, new LinkedHashSet<>());
    list.addItem(media, 0, owner.getId());
    MediaListEntity saved = lists.saveAndFlush(list);
    sleepPastClock();
    return saved;
  }

  private void sleepPastClock() {
    try {
      Thread.sleep(5);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
