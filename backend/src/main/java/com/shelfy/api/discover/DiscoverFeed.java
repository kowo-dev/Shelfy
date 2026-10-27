package com.shelfy.api.discover;

import java.util.Arrays;

public enum DiscoverFeed {
  TRENDING("trending"),
  TOP_RATED("top_rated"),
  NEW("new"),
  UPCOMING("upcoming");

  private final String slug;

  DiscoverFeed(String slug) {
    this.slug = slug;
  }

  public String slug() {
    return slug;
  }

  public static DiscoverFeed fromSlug(String slug) {
    return Arrays.stream(values())
        .filter(feed -> feed.slug.equals(slug))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Unknown discover feed: " + slug));
  }
}
