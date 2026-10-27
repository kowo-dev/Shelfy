package com.shelfy.api.collection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.shelfy.api.anilist.AniListService;
import com.shelfy.api.auth.ViewerPreferences;
import com.shelfy.api.collection.dto.CollectionItemResponseDto;
import com.shelfy.api.collection.dto.MediaResponseDto;
import com.shelfy.api.collection.dto.NextEpisodeResponseDto;
import com.shelfy.api.common.dto.NextAiringDto;
import com.shelfy.api.tmdb.TmdbService;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class NextEpisodeServiceTest {

  private static final UUID USER = UUID.randomUUID();
  private static final LocalDate TODAY = LocalDate.of(2026, 10, 25);

  private final CollectionService collectionService = mock(CollectionService.class);
  private final TmdbService tmdbService = mock(TmdbService.class);
  private final AniListService aniListService = mock(AniListService.class);
  private final ViewerPreferences viewerPreferences = mock(ViewerPreferences.class);
  private final NextEpisodeService service =
      new NextEpisodeService(
          collectionService,
          tmdbService,
          aniListService,
          viewerPreferences,
          Clock.fixed(TODAY.atStartOfDay().toInstant(ZoneOffset.UTC), ZoneOffset.UTC));

  @Test
  void getNextEpisodes_sortsSeriesAndAnimeByAirDateWithinTheWindow() {
    CollectionItemResponseDto series = item("tmdb", MediaType.TV_SHOW, "10", "Severance", false);
    CollectionItemResponseDto anime = item("anilist", MediaType.ANIME, "20", "Frieren", false);
    CollectionItemResponseDto later = item("tmdb", MediaType.TV_SHOW, "30", "Later", false);
    CollectionItemResponseDto ended = item("tmdb", MediaType.TV_SHOW, "40", "Ended", false);
    when(collectionService.getOngoingItems(USER, NextEpisodeService.MAX_ITEMS))
        .thenReturn(List.of(series, anime, later, ended));
    when(tmdbService.getNextEpisode(10))
        .thenReturn(new NextAiringDto(2, 5, "Chikhai Bardo", TODAY.plusDays(3), null, "/s.jpg"));
    Instant airingAt = TODAY.plusDays(1).atTime(15, 0).toInstant(ZoneOffset.UTC);
    when(aniListService.getNextAiring(20))
        .thenReturn(new NextAiringDto(null, 12, null, TODAY.plusDays(1), airingAt, null));
    when(tmdbService.getNextEpisode(30))
        .thenReturn(new NextAiringDto(1, 1, null, TODAY.plusDays(60), null, null));
    when(tmdbService.getNextEpisode(40)).thenReturn(NextAiringDto.NONE);

    List<NextEpisodeResponseDto> next = service.getNextEpisodes(USER);

    assertThat(next)
        .extracting(n -> n.item().media().title())
        .containsExactly("Frieren", "Severance");
    assertThat(next.get(0).airingAt()).isEqualTo(airingAt);
    assertThat(next.get(1).season()).isEqualTo(2);
    assertThat(next.get(1).episode()).isEqualTo(5);
  }

  @Test
  void getNextEpisodes_skipsOtherMediaAdultItemsAndFailingProviders() {
    CollectionItemResponseDto movie = item("tmdb", MediaType.MOVIE, "1", "Film", false);
    CollectionItemResponseDto adult = item("tmdb", MediaType.TV_SHOW, "2", "Adult", true);
    CollectionItemResponseDto broken = item("tmdb", MediaType.TV_SHOW, "3", "Broken", false);
    when(collectionService.getOngoingItems(USER, NextEpisodeService.MAX_ITEMS))
        .thenReturn(List.of(movie, adult, broken));
    when(viewerPreferences.allowsAdultContent(USER)).thenReturn(false);
    when(tmdbService.getNextEpisode(3)).thenThrow(new IllegalStateException("down"));

    assertThat(service.getNextEpisodes(USER)).isEmpty();
    verify(tmdbService, never()).getNextEpisode(1);
    verify(tmdbService, never()).getNextEpisode(2);
    verify(aniListService, never()).getNextAiring(anyLong());
  }

  private static CollectionItemResponseDto item(
      String provider, MediaType type, String externalId, String title, boolean adult) {
    MediaResponseDto media =
        new MediaResponseDto(
            UUID.randomUUID(),
            UUID.randomUUID(),
            externalId,
            provider,
            type,
            title,
            null,
            Map.of(),
            Instant.EPOCH,
            adult);
    return new CollectionItemResponseDto(
        UUID.randomUUID(),
        USER,
        media,
        UserMediaStatus.ONGOING,
        null,
        null,
        false,
        null,
        Instant.EPOCH,
        Instant.EPOCH,
        null);
  }
}
