package com.shelfy.api.lists;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.collection.CanonicalWorkEntity;
import com.shelfy.api.collection.CanonicalWorkRepository;
import com.shelfy.api.collection.MediaEntity;
import com.shelfy.api.collection.MediaRepository;
import com.shelfy.api.collection.MediaType;
import com.shelfy.api.collection.dto.MediaResponseDto;
import com.shelfy.api.community.CommunityFilter;
import com.shelfy.api.community.CommunityScope;
import com.shelfy.api.community.CommunitySort;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class MediaListPreviewTest {

  @Autowired private MediaListService service;
  @Autowired private MediaListRepository lists;
  @Autowired private UserRepository users;
  @Autowired private CanonicalWorkRepository works;
  @Autowired private MediaRepository medias;

  private final String marker = UUID.randomUUID().toString().substring(0, 8);

  @Test
  void preview_prefersTitlesWithACoverAndKeepsTheListOrder() {
    UserEntity owner = user();
    list(
        owner,
        List.of(
            media("A", false),
            media("B", true),
            media("C", false),
            media("D", true),
            media("E", true),
            media("F", true),
            media("G", true)));

    assertEquals(List.of("B", "D", "E", "F"), previewTitles(owner));
  }

  @Test
  void preview_fillsWithCoverlessTitlesOnlyWhenTooFewHaveACover() {
    UserEntity owner = user();
    list(
        owner,
        List.of(
            media("X", false),
            media("Y", true),
            media("Z", false),
            media("W", false),
            media("V", true)));

    assertEquals(List.of("X", "Y", "Z", "V"), previewTitles(owner));
  }

  private List<String> previewTitles(UserEntity owner) {
    var filter = new CommunityFilter(marker, CommunityScope.MINE, null, CommunitySort.RECENT);
    return service
        .browse(owner.getId(), filter, PageRequest.of(0, 10))
        .content()
        .getFirst()
        .previewMedia()
        .stream()
        .map(MediaResponseDto::title)
        .toList();
  }

  private void list(UserEntity owner, List<MediaEntity> items) {
    MediaListEntity list =
        new MediaListEntity(
            owner.getId(),
            "Previews " + marker,
            null,
            CollectionVisibility.PUBLIC,
            new LinkedHashSet<>());
    for (int i = 0; i < items.size(); i++) {
      list.addItem(items.get(i), i, owner.getId());
    }
    lists.saveAndFlush(list);
  }

  private UserEntity user() {
    String name = "preview" + UUID.randomUUID().toString().substring(0, 8);
    UserEntity user = new UserEntity(name + "@example.com", name, "hash");
    user.setProfileVisibility(CollectionVisibility.PUBLIC);
    return users.saveAndFlush(user);
  }

  private MediaEntity media(String title, boolean withCover) {
    CanonicalWorkEntity work = works.saveAndFlush(new CanonicalWorkEntity(MediaType.MOVIE));
    return medias.saveAndFlush(
        new MediaEntity(
            UUID.randomUUID().toString(),
            "test",
            MediaType.MOVIE,
            work,
            title,
            withCover ? "https://img.example/" + title + ".jpg" : null,
            Map.of(),
            false));
  }
}
