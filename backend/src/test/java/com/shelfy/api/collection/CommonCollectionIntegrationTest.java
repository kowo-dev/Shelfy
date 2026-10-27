package com.shelfy.api.collection;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.collection.dto.CollectionFilter;
import com.shelfy.api.collection.dto.CommonCollectionItemResponseDto;
import com.shelfy.api.common.Paging;
import com.shelfy.api.common.dto.PagedResponseDto;
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
class CommonCollectionIntegrationTest {

  private static final CollectionFilter NO_FILTER =
      new CollectionFilter(null, null, null, null, null, null, null);

  @Autowired private UserRepository users;
  @Autowired private CanonicalWorkRepository works;
  @Autowired private MediaRepository medias;
  @Autowired private UserMediaRepository userMedias;
  @Autowired private CollectionService collectionService;

  @Test
  void keepsOnlyTitlesTheCallerAlsoHasAcrossProviders() {
    UserEntity caller = user();
    UserEntity target = user();
    CanonicalWorkEntity shared = work(MediaType.TV_SHOW);
    CanonicalWorkEntity targetOnly = work(MediaType.TV_SHOW);
    CanonicalWorkEntity callerOnly = work(MediaType.TV_SHOW);
    MediaEntity targetCopy = media(shared, "tmdb", "Shared", MediaType.TV_SHOW);
    MediaEntity callerCopy = media(shared, "anilist", "Shared", MediaType.TV_SHOW);
    item(target, targetCopy, UserMediaStatus.DONE, 8);
    item(
        target,
        media(targetOnly, "tmdb", "Mine alone", MediaType.TV_SHOW),
        UserMediaStatus.DONE,
        5);
    UserMediaEntity callerItem = item(caller, callerCopy, UserMediaStatus.ONGOING, null);
    item(caller, media(callerOnly, "tmdb", "Other", MediaType.TV_SHOW), UserMediaStatus.DONE, 9);

    PagedResponseDto<CommonCollectionItemResponseDto> result =
        collectionService.getCommonCollection(
            target.getId(), caller.getId(), NO_FILTER, Paging.of(0, 24));

    assertEquals(1, result.totalElements());
    CommonCollectionItemResponseDto row = result.content().getFirst();
    assertEquals(targetCopy.getId(), row.theirs().media().id());
    assertEquals(callerItem.getId(), row.mine().id());
    assertEquals(caller.getId(), row.mine().userId());
  }

  @Test
  void appliesFiltersToTheTargetAndCountsAcrossPages() {
    UserEntity caller = user();
    UserEntity target = user();
    for (int i = 0; i < 5; i++) {
      CanonicalWorkEntity work = work(MediaType.MOVIE);
      item(target, media(work, "tmdb", "Movie " + i, MediaType.MOVIE), UserMediaStatus.DONE, i + 1);
      item(
          caller,
          media(work, "tmdb", "Movie " + i, MediaType.MOVIE),
          UserMediaStatus.PLANNED,
          null);
    }
    CanonicalWorkEntity game = work(MediaType.GAME);
    item(target, media(game, "igdb", "Game", MediaType.GAME), UserMediaStatus.DONE, 9);
    item(caller, media(game, "igdb", "Game", MediaType.GAME), UserMediaStatus.DONE, 9);

    CollectionFilter moviesOnly =
        new CollectionFilter(null, List.of(MediaType.MOVIE), null, null, null, null, null);
    PagedResponseDto<CommonCollectionItemResponseDto> firstPage =
        collectionService.getCommonCollection(
            target.getId(),
            caller.getId(),
            moviesOnly,
            Paging.of(0, 2, CollectionSort.resolve("title", "asc")));
    PagedResponseDto<CommonCollectionItemResponseDto> lastPage =
        collectionService.getCommonCollection(
            target.getId(),
            caller.getId(),
            moviesOnly,
            Paging.of(2, 2, CollectionSort.resolve("title", "asc")));
    CollectionFilter topRated = new CollectionFilter(null, null, false, 8, null, null, null);
    PagedResponseDto<CommonCollectionItemResponseDto> rated =
        collectionService.getCommonCollection(
            target.getId(), caller.getId(), topRated, Paging.of(0, 24));

    assertEquals(5, firstPage.totalElements());
    assertEquals(
        List.of("Movie 0", "Movie 1"),
        firstPage.content().stream().map(r -> r.theirs().media().title()).toList());
    assertEquals(1, lastPage.content().size());
    assertEquals(1, rated.totalElements());
    assertEquals("Game", rated.content().getFirst().theirs().media().title());
  }

  @Test
  void shelfSearchIgnoresAccentsAndCase() {
    UserEntity owner = user();
    item(
        owner,
        media(work(MediaType.MOVIE), "tmdb", "Amélie", MediaType.MOVIE),
        UserMediaStatus.DONE,
        8);
    item(
        owner,
        media(work(MediaType.MOVIE), "tmdb", "Alien", MediaType.MOVIE),
        UserMediaStatus.DONE,
        7);

    var page =
        userMedias.findByUserIdAndFilters(
            owner.getId(),
            null,
            null,
            true,
            null,
            null,
            "AMELIE",
            true,
            false,
            PageRequest.of(0, 24));

    assertEquals(
        List.of("Amélie"),
        page.getContent().stream().map(entry -> entry.getMedia().getTitle()).toList());
  }

  @Test
  void returnsNothingWhenTheCallerHasNoShelf() {
    UserEntity caller = user();
    UserEntity target = user();
    item(
        target,
        media(work(MediaType.MOVIE), "tmdb", "Solo", MediaType.MOVIE),
        UserMediaStatus.DONE,
        7);

    PagedResponseDto<CommonCollectionItemResponseDto> result =
        collectionService.getCommonCollection(
            target.getId(), caller.getId(), NO_FILTER, Paging.of(0, 24));

    assertEquals(0, result.totalElements());
    assertEquals(List.of(), result.content());
  }

  private UserEntity user() {
    String name = "u" + UUID.randomUUID().toString().substring(0, 12);
    return users.saveAndFlush(new UserEntity(name + "@example.com", name, "hash"));
  }

  private CanonicalWorkEntity work(MediaType type) {
    return works.saveAndFlush(new CanonicalWorkEntity(type));
  }

  private MediaEntity media(
      CanonicalWorkEntity work, String provider, String title, MediaType type) {
    return medias.saveAndFlush(
        new MediaEntity(
            UUID.randomUUID().toString(), provider, type, work, title, null, Map.of(), false));
  }

  private UserMediaEntity item(
      UserEntity owner, MediaEntity media, UserMediaStatus status, Integer rating) {
    return userMedias.saveAndFlush(
        new UserMediaEntity(owner.getId(), media, status, rating, Map.of()));
  }
}
