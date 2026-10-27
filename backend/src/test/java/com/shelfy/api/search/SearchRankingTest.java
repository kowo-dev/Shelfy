package com.shelfy.api.search;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.shelfy.api.collection.MediaType;
import com.shelfy.api.search.dto.SearchResultResponseDto;
import java.util.List;
import org.junit.jupiter.api.Test;

class SearchRankingTest {

  @Test
  void sortByPopularity_putsWellKnownTitlesBeforeNicheOnesWithHigherRatings() {
    var results =
        List.of(
            result("tmdb", MediaType.MOVIE, "Forbidden Journey", 10.0, 1),
            result("igdb", MediaType.GAME, "Some game", null, null),
            result("anilist", MediaType.ANIME, "Star Wars: Visions", 7.0, 41_439),
            result("tmdb", MediaType.MOVIE, "LEGO Star Wars", 6.7, 38),
            result("tmdb", MediaType.MOVIE, "Star Wars", 8.2, 22_999));

    assertEquals(
        List.of(
            "Star Wars", "Star Wars: Visions", "LEGO Star Wars", "Forbidden Journey", "Some game"),
        SearchRanking.sortByPopularity(results).stream()
            .map(SearchResultResponseDto::title)
            .toList());
  }

  @Test
  void sortByPopularity_keepsProviderOrderWhenThereIsNoPopularitySignal() {
    var results =
        List.of(
            result("igdb", MediaType.GAME, "First", null, null),
            result("igdb", MediaType.GAME, "Second", null, null));

    assertEquals(
        List.of("First", "Second"),
        SearchRanking.sortByPopularity(results).stream()
            .map(SearchResultResponseDto::title)
            .toList());
  }

  private static SearchResultResponseDto result(
      String provider, MediaType type, String title, Double rating, Integer votes) {
    return new SearchResultResponseDto(
        provider, type, title, title, null, null, null, List.of(), rating, votes, null, false);
  }
}
