package com.shelfy.api.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableCaching
public class CacheConfig {

  public static final String TMDB_MOVIE_GENRES = "tmdbMovieGenres";
  public static final String TMDB_TV_GENRES = "tmdbTvGenres";
  public static final String TMDB_KEYWORD_IDS = "tmdbKeywordIds";
  public static final String TMDB_WATCH_PROVIDERS = "tmdbWatchProviders";
  public static final String ANILIST_GENRES = "anilistGenres";
  public static final String ANILIST_TAGS = "anilistTags";
  public static final String IGDB_FACETS = "igdbFacets";
  public static final String IGDB_KEYWORD_IDS = "igdbKeywordIds";

  private static final int LOOKUP_MAX_ENTRIES = 1_000;

  @Bean
  public CacheManager cacheManager() {
    CaffeineCacheManager manager = new CaffeineCacheManager();
    for (String genres : new String[] {TMDB_MOVIE_GENRES, TMDB_TV_GENRES}) {
      manager.registerCustomCache(
          genres, Caffeine.newBuilder().expireAfterWrite(Duration.ofDays(1)).build());
    }
    for (String lookup :
        new String[] {
          TMDB_KEYWORD_IDS,
          TMDB_WATCH_PROVIDERS,
          ANILIST_GENRES,
          ANILIST_TAGS,
          IGDB_FACETS,
          IGDB_KEYWORD_IDS
        }) {
      manager.registerCustomCache(
          lookup,
          Caffeine.newBuilder()
              .maximumSize(LOOKUP_MAX_ENTRIES)
              .expireAfterWrite(Duration.ofDays(1))
              .build());
    }
    return manager;
  }
}
