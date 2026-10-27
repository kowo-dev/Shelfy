package com.shelfy.api.search;

import java.util.Arrays;

public enum ExploreSort {
  POPULAR("popular"),
  RATING("rating"),
  RECENT("recent");

  private final String value;

  ExploreSort(String value) {
    this.value = value;
  }

  public static ExploreSort fromValue(String value) {
    return Arrays.stream(values())
        .filter(sort -> sort.value.equals(value))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Invalid sort"));
  }
}
