package com.shelfy.api.collection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.shelfy.api.anilist.AniListService;
import com.shelfy.api.igdb.IgdbProperties;
import com.shelfy.api.igdb.IgdbService;
import com.shelfy.api.igdb.dto.GameSummaryResponseDto;
import com.shelfy.api.tmdb.TmdbProperties;
import com.shelfy.api.tmdb.TmdbService;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class MediaCatalogServiceTest {

  private final MediaCatalogService service =
      new MediaCatalogService(
          mock(TmdbService.class),
          mock(TmdbProperties.class),
          mock(IgdbService.class),
          new IgdbProperties(null, null, "https://igdb/t_1080p/", null, null),
          mock(AniListService.class));

  @Test
  void gameBackdropPrefersArtworkThenScreenshot() {
    assertThat(service.buildGameMetadata(game(List.of("art"), List.of("shot"))))
        .containsEntry("backdropUrl", "https://igdb/t_1080p/art.jpg");
    assertThat(service.buildGameMetadata(game(List.of(), List.of("shot"))))
        .containsEntry("backdropUrl", "https://igdb/t_1080p/shot.jpg");
    assertThat(service.buildGameMetadata(game(null, null))).doesNotContainKey("backdropUrl");
  }

  private static GameSummaryResponseDto game(List<String> artworks, List<String> screenshots) {
    return new GameSummaryResponseDto(
        1L,
        "Game",
        "",
        LocalDate.of(2020, 1, 1),
        null,
        screenshots,
        artworks,
        List.of(),
        List.of(),
        8.0,
        100,
        false);
  }
}
