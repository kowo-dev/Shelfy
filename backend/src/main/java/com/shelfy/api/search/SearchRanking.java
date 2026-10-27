package com.shelfy.api.search;

import com.shelfy.api.search.dto.SearchResultResponseDto;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

final class SearchRanking {

  private static final Map<String, Integer> POPULAR_VOTE_COUNT_BY_PROVIDER =
      Map.of("tmdb", 30_000, "igdb", 3_000, "anilist", 500_000);
  private static final double RATING_WEIGHT = 0.25;
  private static final double MAX_RATING = 10.0;

  private SearchRanking() {}

  static List<SearchResultResponseDto> sortByPopularity(List<SearchResultResponseDto> results) {
    return results.stream()
        .sorted(Comparator.comparingDouble(SearchRanking::score).reversed())
        .toList();
  }

  static double score(SearchResultResponseDto result) {
    Integer reference = POPULAR_VOTE_COUNT_BY_PROVIDER.get(result.provider());
    if (reference == null || result.voteCount() == null || result.voteCount() <= 0) {
      return 0;
    }
    double popularity = Math.min(1, Math.log1p(result.voteCount()) / Math.log1p(reference));
    double rating = result.voteAverage() == null ? 0 : result.voteAverage() / MAX_RATING;
    return popularity * (1 - RATING_WEIGHT + RATING_WEIGHT * rating);
  }
}
