package com.shelfy.api.essentials;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

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
import com.shelfy.api.common.exception.BadRequestException;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.essentials.dto.EssentialEntryResponseDto;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class EssentialsServiceIntegrationTest {

  @Autowired private EssentialsService essentials;
  @Autowired private UserRepository users;
  @Autowired private CanonicalWorkRepository works;
  @Autowired private MediaRepository medias;
  @Autowired private UserMediaRepository userMedias;

  @Test
  void replace_storesTitlesInTheGivenOrderAndCanBeReordered() {
    UserEntity owner = user();
    UserMediaEntity game = item(owner, MediaType.GAME);
    UserMediaEntity movie = item(owner, MediaType.MOVIE);
    UserMediaEntity manga = item(owner, MediaType.MANGA);

    essentials.replace(owner.getId(), List.of(game.getId(), movie.getId(), manga.getId()), true);
    List<EssentialEntryResponseDto> reordered =
        essentials.replace(owner.getId(), List.of(manga.getId(), game.getId()), true);

    assertEquals(
        List.of(manga.getId(), game.getId()),
        reordered.stream().map(EssentialEntryResponseDto::userMediaId).toList());
    assertEquals(List.of(0, 1), reordered.stream().map(EssentialEntryResponseDto::slot).toList());
  }

  @Test
  void replace_rejectsTheSameTitleTwice() {
    UserEntity owner = user();
    UUID game = item(owner, MediaType.GAME).getId();

    assertThrows(
        BadRequestException.class,
        () -> essentials.replace(owner.getId(), List.of(game, game), true));
  }

  @Test
  void replace_rejectsTitlesFromAnotherShelf() {
    UserEntity owner = user();
    UUID foreign = item(user(), MediaType.GAME).getId();

    assertThrows(
        ResourceNotFoundException.class,
        () -> essentials.replace(owner.getId(), List.of(foreign), true));
  }

  @Test
  void getEssentials_masksAdultTitlesWhenTheViewerHidesThem() {
    UserEntity owner = user();
    CanonicalWorkEntity work = works.saveAndFlush(new CanonicalWorkEntity(MediaType.ANIME));
    MediaEntity adult =
        medias.saveAndFlush(
            new MediaEntity(
                UUID.randomUUID().toString(),
                "test",
                MediaType.ANIME,
                work,
                "Secret",
                null,
                Map.of(),
                true));
    UserMediaEntity item =
        userMedias.saveAndFlush(
            new UserMediaEntity(owner.getId(), adult, UserMediaStatus.DONE, null, Map.of()));
    essentials.replace(owner.getId(), List.of(item.getId()), true);

    assertEquals("", essentials.getEssentials(owner.getId(), false).get(0).media().title());
  }

  private UserEntity user() {
    String name = "u" + UUID.randomUUID().toString().substring(0, 12);
    return users.saveAndFlush(new UserEntity(name + "@example.com", name, "hash"));
  }

  private UserMediaEntity item(UserEntity owner, MediaType type) {
    CanonicalWorkEntity work = works.saveAndFlush(new CanonicalWorkEntity(type));
    MediaEntity media =
        medias.saveAndFlush(
            new MediaEntity(
                UUID.randomUUID().toString(), "test", type, work, "Title", null, Map.of(), false));
    return userMedias.saveAndFlush(
        new UserMediaEntity(owner.getId(), media, UserMediaStatus.DONE, null, Map.of()));
  }
}
