package com.shelfy.api.igdb.client;

import java.util.List;

public record IgdbExploreQuery(
    String search,
    List<Long> genres,
    List<Long> themes,
    List<Long> keywords,
    List<Long> platforms,
    List<Long> withoutGenres,
    List<Long> withoutThemes,
    List<Long> withoutKeywords,
    Long releasedFrom,
    Long releasedTo,
    Sort sort,
    int limit,
    int offset,
    boolean includeAdult) {

  public enum Sort {
    POPULAR,
    RATING,
    RECENT
  }

  public IgdbExploreQuery {
    genres = List.copyOf(genres);
    themes = List.copyOf(themes);
    keywords = List.copyOf(keywords);
    platforms = List.copyOf(platforms);
    withoutGenres = List.copyOf(withoutGenres);
    withoutThemes = List.copyOf(withoutThemes);
    withoutKeywords = List.copyOf(withoutKeywords);
  }

  public IgdbExploreQuery withLimit(int newLimit) {
    return new IgdbExploreQuery(
        search,
        genres,
        themes,
        keywords,
        platforms,
        withoutGenres,
        withoutThemes,
        withoutKeywords,
        releasedFrom,
        releasedTo,
        sort,
        newLimit,
        offset,
        includeAdult);
  }
}
