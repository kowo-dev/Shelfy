package com.shelfy.api.lists;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.community.CommunityFilter;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class MediaListVisibilityTest {

  private static final UUID ANONYMOUS = new UUID(0, 0);

  @Autowired private MediaListRepository lists;
  @Autowired private UserRepository users;

  @Test
  void findVisibleByOwner_listsOnlyPublicListsToOthers() {
    UserEntity owner = user(CollectionVisibility.PUBLIC);
    UserEntity stranger = user(CollectionVisibility.PUBLIC);
    MediaListEntity open = list(owner, CollectionVisibility.PUBLIC);
    MediaListEntity shared = list(owner, CollectionVisibility.LINK);
    MediaListEntity hidden = list(owner, CollectionVisibility.PRIVATE);

    assertEquals(Set.of(open.getId()), idsByOwner(owner, ANONYMOUS));
    assertEquals(Set.of(open.getId()), idsByOwner(owner, stranger.getId()));
    assertEquals(
        Set.of(open.getId(), shared.getId(), hidden.getId()), idsByOwner(owner, owner.getId()));
  }

  @Test
  void findVisibleByOwner_narrowsByNameIgnoringCaseAndAccents() {
    UserEntity owner = user(CollectionVisibility.PUBLIC);
    MediaListEntity cinema = list(owner, "Soirée Cinéma", CollectionVisibility.PUBLIC);
    list(owner, "Road trip", CollectionVisibility.PUBLIC);

    var page =
        lists.findVisibleByOwner(
            owner.getId(),
            owner.getId(),
            CommunityFilter.likePattern("CINE"),
            PageRequest.of(0, 100));

    assertEquals(1, page.getTotalElements());
    assertEquals(cinema.getId(), page.getContent().getFirst().getId());
  }

  @Test
  void browse_hidesListsOfPrivateProfilesAndCountsOnlyVisibleOnes() {
    UserEntity privateOwner = user(CollectionVisibility.PRIVATE);
    UserEntity publicOwner = user(CollectionVisibility.PUBLIC);
    UserEntity stranger = user(CollectionVisibility.PUBLIC);
    MediaListEntity fromPrivateProfile = list(privateOwner, CollectionVisibility.PUBLIC);
    MediaListEntity fromPublicProfile = list(publicOwner, CollectionVisibility.PUBLIC);
    list(publicOwner, CollectionVisibility.PRIVATE);

    var page = lists.browse(stranger.getId(), CommunityFilter.NONE, PageRequest.of(0, 100));
    Set<UUID> ids = new LinkedHashSet<>();
    page.getContent().forEach(l -> ids.add(l.getId()));

    assertTrue(ids.contains(fromPublicProfile.getId()));
    assertFalse(ids.contains(fromPrivateProfile.getId()));
    assertEquals(ids.size(), page.getTotalElements());
  }

  private Set<UUID> idsByOwner(UserEntity owner, UUID viewer) {
    Set<UUID> ids = new LinkedHashSet<>();
    lists
        .findVisibleByOwner(owner.getId(), viewer, "", PageRequest.of(0, 100))
        .forEach(l -> ids.add(l.getId()));
    return ids;
  }

  private UserEntity user(CollectionVisibility profileVisibility) {
    String name = "u" + UUID.randomUUID().toString().substring(0, 12);
    UserEntity user = new UserEntity(name + "@example.com", name, "hash");
    user.setProfileVisibility(profileVisibility);
    return users.saveAndFlush(user);
  }

  private MediaListEntity list(UserEntity owner, CollectionVisibility visibility) {
    return list(owner, "list", visibility);
  }

  private MediaListEntity list(UserEntity owner, String name, CollectionVisibility visibility) {
    return lists.saveAndFlush(
        new MediaListEntity(owner.getId(), name, null, visibility, new LinkedHashSet<>()));
  }
}
