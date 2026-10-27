package com.shelfy.api.discover.cache;

import com.shelfy.api.anilist.AniListService;
import com.shelfy.api.common.dto.PagedResponseDto;
import com.shelfy.api.discover.DiscoverFeed;
import com.shelfy.api.igdb.IgdbService;
import com.shelfy.api.tmdb.TmdbService;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
public class DiscoverCacheService {

  public static final String MOVIE = "movie";
  public static final String TV_SHOW = "tv_show";
  public static final String GAME = "game";
  public static final String ANIME = "anime";
  public static final String MANGA = "manga";
  public static final String WEBTOON = "webtoon";

  private static final Logger log = LoggerFactory.getLogger(DiscoverCacheService.class);

  private final DiscoverCacheRepository repository;
  private final ObjectMapper objectMapper;
  private final TmdbService tmdbService;
  private final IgdbService igdbService;
  private final AniListService aniListService;

  public void refreshAll() {
    refreshCategory(MOVIE, DiscoverFeed.TRENDING, tmdbService::getTrendingMoviesWide);
    refreshCategory(TV_SHOW, DiscoverFeed.TRENDING, tmdbService::getTrendingTvShowsWide);
    refreshCategory(GAME, DiscoverFeed.TRENDING, igdbService::getTrendingGamesWide);
    refreshCategory(ANIME, DiscoverFeed.TRENDING, aniListService::getTrendingAnimeWide);
    refreshCategory(MANGA, DiscoverFeed.TRENDING, aniListService::getTrendingMangaWide);
    refreshCategory(WEBTOON, DiscoverFeed.TRENDING, aniListService::getTrendingWebtoonsWide);

    refreshCategory(MOVIE, DiscoverFeed.TOP_RATED, tmdbService::getTopRatedMoviesWide);
    refreshCategory(TV_SHOW, DiscoverFeed.TOP_RATED, tmdbService::getTopRatedTvShowsWide);
    refreshCategory(GAME, DiscoverFeed.TOP_RATED, igdbService::getTopRatedGamesWide);
    refreshCategory(ANIME, DiscoverFeed.TOP_RATED, aniListService::getTopRatedAnimeWide);
    refreshCategory(MANGA, DiscoverFeed.TOP_RATED, aniListService::getTopRatedMangaWide);
    refreshCategory(WEBTOON, DiscoverFeed.TOP_RATED, aniListService::getTopRatedWebtoonsWide);

    refreshCategory(MOVIE, DiscoverFeed.NEW, tmdbService::getNewMoviesWide);
    refreshCategory(TV_SHOW, DiscoverFeed.NEW, tmdbService::getNewTvShowsWide);
    refreshCategory(GAME, DiscoverFeed.NEW, igdbService::getNewGamesWide);
    refreshCategory(ANIME, DiscoverFeed.NEW, aniListService::getNewAnimeWide);
    refreshCategory(MANGA, DiscoverFeed.NEW, aniListService::getNewMangaWide);
    refreshCategory(WEBTOON, DiscoverFeed.NEW, aniListService::getNewWebtoonsWide);

    refreshCategory(MOVIE, DiscoverFeed.UPCOMING, tmdbService::getUpcomingMoviesWide);
    refreshCategory(TV_SHOW, DiscoverFeed.UPCOMING, tmdbService::getUpcomingTvShowsWide);
    refreshCategory(GAME, DiscoverFeed.UPCOMING, igdbService::getUpcomingGamesWide);
    refreshCategory(ANIME, DiscoverFeed.UPCOMING, aniListService::getUpcomingAnimeWide);
  }

  static String cacheKey(String category, DiscoverFeed feed) {
    return feed == DiscoverFeed.TRENDING ? category : category + ":" + feed.slug();
  }

  private <T> void refreshCategory(String category, DiscoverFeed feed, Supplier<List<T>> fetcher) {
    String key = cacheKey(category, feed);
    try {
      List<T> items = fetcher.get();
      upsert(key, items);
      log.info("Discover cache refreshed for {} ({} items)", key, items.size());
    } catch (Exception ex) {
      log.error("Discover cache refresh failed for {}", key, ex);
    }
  }

  private <T> void upsert(String category, List<T> items) {
    DiscoverCacheEntity cache =
        repository.findByCategory(category).orElseGet(DiscoverCacheEntity::new);
    cache.setCategory(category);
    cache.setItems(
        objectMapper.convertValue(items, new TypeReference<List<Map<String, Object>>>() {}));
    cache.setItemCount(items.size());
    cache.setRefreshedAt(Instant.now());
    repository.save(cache);
  }

  public <T> PagedResponseDto<T> slice(
      String category, DiscoverFeed feed, int page, int size, Class<T> type) {
    return repository
        .findByCategory(cacheKey(category, feed))
        .map(
            cache -> {
              List<T> all =
                  cache.getItems().stream()
                      .map(raw -> convertSafely(raw, type))
                      .filter(Objects::nonNull)
                      .toList();
              int from = Math.min(page * size, all.size());
              int to = Math.min(from + size, all.size());
              return new PagedResponseDto<>(all.subList(from, to), page, size, all.size());
            })
        .orElseGet(() -> new PagedResponseDto<>(List.of(), page, size, 0));
  }

  private <T> T convertSafely(Map<String, Object> raw, Class<T> type) {
    try {
      return objectMapper.convertValue(raw, type);
    } catch (Exception ex) {
      log.warn("Skipping malformed cached item for type {}", type.getSimpleName(), ex);
      return null;
    }
  }
}
