package com.shelfy.api.anilist.client;

import java.util.List;

public record AniListExploreQuery(
    String search,
    List<String> genres,
    List<String> withoutGenres,
    List<String> tags,
    List<String> withoutTags,
    Integer startedFrom,
    Integer startedTo,
    Sort sort,
    int page,
    int perPage,
    boolean includeAdult) {

  public enum Sort {
    POPULAR,
    RATING,
    RECENT
  }

  public AniListExploreQuery {
    genres = List.copyOf(genres);
    withoutGenres = List.copyOf(withoutGenres);
    tags = List.copyOf(tags);
    withoutTags = List.copyOf(withoutTags);
  }
}
