package com.shelfy.api.tmdb.client;

import java.time.LocalDate;
import java.util.List;

public record TmdbDiscoverQuery(
    List<Integer> genres,
    List<Integer> withoutGenres,
    List<Integer> keywords,
    List<Integer> withoutKeywords,
    List<Integer> watchProviders,
    String watchRegion,
    LocalDate releasedFrom,
    LocalDate releasedTo,
    Sort sort,
    int page,
    boolean includeAdult) {

  public enum Sort {
    POPULAR,
    RATING,
    RECENT
  }

  public TmdbDiscoverQuery {
    genres = List.copyOf(genres);
    withoutGenres = List.copyOf(withoutGenres);
    keywords = List.copyOf(keywords);
    withoutKeywords = List.copyOf(withoutKeywords);
    watchProviders = List.copyOf(watchProviders);
  }
}
