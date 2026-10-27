package com.shelfy.api.common.cache;

import java.time.Duration;

public enum ProviderCacheSpace {
  TMDB_MOVIE("tmdb-movie-2", Policy.DETAIL),
  TMDB_TV_SHOW("tmdb-tv-2", Policy.DETAIL),
  TMDB_TV_SEASON("tmdb-tv-season", Policy.DETAIL),
  TMDB_TV_NEXT("tmdb-tv-next", Policy.SEARCH),
  ANILIST_ANIME("anilist-anime", Policy.DETAIL),
  ANILIST_MANGA("anilist-manga", Policy.DETAIL),
  ANILIST_ANIME_NEXT("anilist-anime-next", Policy.SEARCH),
  IGDB_GAME("igdb-game", Policy.DETAIL),
  SEARCH_TMDB_MOVIE("search-tmdb-movie", Policy.SEARCH),
  SEARCH_TMDB_TV("search-tmdb-tv", Policy.SEARCH),
  SEARCH_IGDB("search-igdb", Policy.SEARCH),
  SEARCH_ANILIST("search-anilist", Policy.SEARCH),
  EXPLORE("explore", Policy.SEARCH);

  private final String namespace;
  private final Policy policy;

  ProviderCacheSpace(String namespace, Policy policy) {
    this.namespace = namespace;
    this.policy = policy;
  }

  public String namespace() {
    return namespace;
  }

  public Duration freshFor() {
    return policy.freshFor;
  }

  public Duration keptFor() {
    return policy.keptFor;
  }

  private enum Policy {
    DETAIL(Duration.ofDays(1), Duration.ofDays(30)),
    SEARCH(Duration.ofHours(6), Duration.ofDays(3));

    private final Duration freshFor;
    private final Duration keptFor;

    Policy(Duration freshFor, Duration keptFor) {
      this.freshFor = freshFor;
      this.keptFor = keptFor;
    }
  }
}
