package com.shelfy.api.collection;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.JpaSort;

public final class CollectionSort {

  private static final Sort TIEBREAKER = Sort.by(Sort.Direction.ASC, "id");
  private static final Sort UNRATED_LAST =
      JpaSort.unsafe(Sort.Direction.ASC, "(case when um.rating is null then 1 else 0 end)");

  private CollectionSort() {}

  public static Sort resolve(String sortBy, String sortDirection) {
    Sort.Direction direction =
        "asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC;
    if ("rating".equals(sortBy)) {
      return UNRATED_LAST.and(Sort.by(direction, "rating")).and(TIEBREAKER);
    }
    String property =
        switch (sortBy == null ? "" : sortBy) {
          case "title" -> "media.title";
          case "updatedAt" -> "updatedAt";
          default -> "createdAt";
        };
    return Sort.by(direction, property).and(TIEBREAKER);
  }
}
