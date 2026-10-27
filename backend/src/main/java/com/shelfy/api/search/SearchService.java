package com.shelfy.api.search;

import com.shelfy.api.anilist.AniListService;
import com.shelfy.api.anilist.dto.AniListSearchResultsDto;
import com.shelfy.api.auth.ViewerPreferences;
import com.shelfy.api.collection.MediaType;
import com.shelfy.api.common.cache.ProviderCache;
import com.shelfy.api.common.cache.ProviderCacheSpace;
import com.shelfy.api.common.http.ProviderRateLimiter;
import com.shelfy.api.igdb.IgdbService;
import com.shelfy.api.igdb.client.IgdbClient;
import com.shelfy.api.search.dto.SearchResponseDto;
import com.shelfy.api.search.dto.SearchResultResponseDto;
import com.shelfy.api.tmdb.TmdbService;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

@Service
public class SearchService {

  private static final Logger LOG = LoggerFactory.getLogger(SearchService.class);
  private static final long PROVIDER_TIMEOUT_SECONDS = 3;
  private static final long ANILIST_CIRCUIT_BREAKER_COOLDOWN_SECONDS = 30;
  private static final int ANILIST_FAILURES_BEFORE_CIRCUIT_BREAK = 2;

  private static final String TMDB_PROVIDER = SearchResultMapper.TMDB_PROVIDER;
  private static final String IGDB_PROVIDER = SearchResultMapper.IGDB_PROVIDER;
  private static final String ANILIST_PROVIDER = SearchResultMapper.ANILIST_PROVIDER;
  private static final int ANILIST_PAGE_SIZE = 20;
  private static final int MAX_QUERY_LENGTH = 200;
  private static final int MAX_PAGE = 500;
  private static final int SLOW_PROVIDER_MIN_LENGTH = 3;
  private static final Duration PROVIDER_RATE_WAIT = Duration.ofSeconds(1);
  private static final Pattern WHITESPACE = Pattern.compile("\\s+");

  private final TmdbService tmdbService;
  private final IgdbService igdbService;
  private final AniListService aniListService;
  private final InCollectionMarker inCollectionMarker;
  private final SearchResultMapper mapper;
  private final ViewerPreferences viewerPreferences;
  private final ProviderCache providerCache;
  private final Executor searchExecutor;
  private final AtomicInteger consecutiveAniListFailures = new AtomicInteger();
  private final AtomicLong aniListUnavailableUntilMillis = new AtomicLong();

  public SearchService(
      TmdbService tmdbService,
      IgdbService igdbService,
      AniListService aniListService,
      InCollectionMarker inCollectionMarker,
      SearchResultMapper mapper,
      ViewerPreferences viewerPreferences,
      ProviderCache providerCache,
      @Qualifier("searchExecutor") Executor searchExecutor) {
    this.tmdbService = tmdbService;
    this.igdbService = igdbService;
    this.aniListService = aniListService;
    this.inCollectionMarker = inCollectionMarker;
    this.mapper = mapper;
    this.viewerPreferences = viewerPreferences;
    this.providerCache = providerCache;
    this.searchExecutor = searchExecutor;
  }

  public SearchResponseDto search(UUID userId, String query, int page, MediaType type) {
    if (query == null
        || query.length() > MAX_QUERY_LENGTH
        || query.chars().anyMatch(Character::isISOControl)
        || page < 1
        || page > MAX_PAGE) {
      throw new IllegalArgumentException("Invalid search parameters");
    }
    boolean includeAdult = viewerPreferences.allowsAdultContent(userId);
    String normalized = normalize(query);
    String key = page + ":" + normalized;
    String adultKey = (includeAdult ? "adult:" : "safe:") + key;
    boolean everyType = type == null;
    boolean slowProvidersWorthIt = !everyType || normalized.length() >= SLOW_PROVIDER_MIN_LENGTH;
    List<CompletableFuture<ProviderSearchResult>> searches = new ArrayList<>();
    if (wants(type, MediaType.MOVIE)) {
      searches.add(
          searchAsync(
              TMDB_PROVIDER,
              ProviderCacheSpace.SEARCH_TMDB_MOVIE,
              adultKey,
              () -> {
                var movies = tmdbService.searchMovies(query, page, includeAdult);
                return new CachedSearchPage(
                    movies.results().stream().map(mapper::toResult).toList(),
                    page < movies.totalPages());
              }));
    }
    if (wants(type, MediaType.TV_SHOW)) {
      searches.add(
          searchAsync(
              TMDB_PROVIDER,
              ProviderCacheSpace.SEARCH_TMDB_TV,
              adultKey,
              () -> {
                var tvShows = tmdbService.searchTvShows(query, page, includeAdult);
                return new CachedSearchPage(
                    tvShows.results().stream().map(mapper::toResult).toList(),
                    page < tvShows.totalPages());
              }));
    }
    if (wants(type, MediaType.GAME)) {
      searches.add(
          searchAsync(
              IGDB_PROVIDER,
              ProviderCacheSpace.SEARCH_IGDB,
              adultKey,
              () -> {
                var games = igdbService.searchGames(query, includeAdult, page);
                return new CachedSearchPage(
                    games.stream().map(mapper::toResult).toList(),
                    games.size() == IgdbClient.SEARCH_PAGE_SIZE);
              }));
    }
    if (slowProvidersWorthIt
        && (wants(type, MediaType.ANIME)
            || wants(type, MediaType.MANGA)
            || wants(type, MediaType.WEBTOON))) {
      String aniListKey = (everyType ? "all" : type.getValue()) + ":" + key;
      searches.add(
          searchAsync(
              ANILIST_PROVIDER,
              ProviderCacheSpace.SEARCH_ANILIST,
              aniListKey,
              () -> searchAniList(query, type, page)));
    }

    List<ProviderSearchResult> providerResults =
        searches.stream().map(CompletableFuture::join).toList();
    List<SearchResultResponseDto> results =
        SearchRanking.sortByPopularity(
            providerResults.stream().flatMap(result -> result.results().stream()).toList());
    List<String> unavailableProviders =
        providerResults.stream()
            .filter(ProviderSearchResult::isUnavailable)
            .map(ProviderSearchResult::provider)
            .distinct()
            .toList();
    boolean hasMore = providerResults.stream().anyMatch(ProviderSearchResult::hasMore);
    return new SearchResponseDto(
        inCollectionMarker.mark(userId, results), page, hasMore, unavailableProviders);
  }

  private CompletableFuture<ProviderSearchResult> searchAsync(
      String provider, ProviderCacheSpace space, String key, Supplier<CachedSearchPage> search) {
    boolean aniList = ANILIST_PROVIDER.equals(provider);
    boolean circuitOpen = aniList && isAniListCircuitOpen();
    Supplier<CachedSearchPage> guarded =
        circuitOpen
            ? () -> {
              throw new IllegalStateException("AniList circuit open");
            }
            : search;
    return CompletableFuture.supplyAsync(
            () ->
                ScopedValue.where(ProviderRateLimiter.MAX_WAIT, PROVIDER_RATE_WAIT)
                    .call(
                        () -> {
                          CachedSearchPage cached =
                              providerCache.get(space, key, CachedSearchPage.class, guarded);
                          return new ProviderSearchResult(
                              provider, cached.results(), cached.hasMore(), false);
                        }),
            searchExecutor)
        .exceptionally(
            ex -> {
              LOG.warn(
                  "{} search failed; returning partial search results: {}",
                  provider,
                  ex.getMessage());
              return unavailable(provider);
            })
        .completeOnTimeout(unavailable(provider), PROVIDER_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .thenApply(
            result -> {
              if (aniList && !circuitOpen) {
                recordAniListResult(result.isUnavailable());
              }
              return result;
            });
  }

  static String normalize(String query) {
    return WHITESPACE.matcher(query.strip()).replaceAll(" ").toLowerCase(Locale.ROOT);
  }

  private boolean isAniListCircuitOpen() {
    return System.currentTimeMillis() < aniListUnavailableUntilMillis.get();
  }

  private void recordAniListResult(boolean unavailable) {
    if (!unavailable) {
      consecutiveAniListFailures.set(0);
      return;
    }
    if (consecutiveAniListFailures.incrementAndGet() < ANILIST_FAILURES_BEFORE_CIRCUIT_BREAK) {
      return;
    }
    aniListUnavailableUntilMillis.set(
        System.currentTimeMillis()
            + TimeUnit.SECONDS.toMillis(ANILIST_CIRCUIT_BREAKER_COOLDOWN_SECONDS));
    consecutiveAniListFailures.set(0);
    LOG.warn(
        "AniList circuit opened for {} seconds after repeated search failures",
        ANILIST_CIRCUIT_BREAKER_COOLDOWN_SECONDS);
  }

  private static boolean wants(MediaType requested, MediaType candidate) {
    return requested == null || requested == candidate;
  }

  private CachedSearchPage searchAniList(String query, MediaType type, int page) {
    if (type == null) {
      AniListSearchResultsDto found = aniListService.searchEveryFormat(query, page);
      List<SearchResultResponseDto> results = new ArrayList<>();
      found.anime().forEach(item -> results.add(mapper.toResult(item)));
      found.manga().forEach(item -> results.add(mapper.toResult(item, MediaType.MANGA)));
      found.webtoons().forEach(item -> results.add(mapper.toResult(item, MediaType.WEBTOON)));
      boolean hasMore =
          found.anime().size() == ANILIST_PAGE_SIZE
              || found.manga().size() == ANILIST_PAGE_SIZE
              || found.webtoons().size() == ANILIST_PAGE_SIZE;
      return new CachedSearchPage(results, hasMore);
    }
    List<SearchResultResponseDto> results =
        switch (type) {
          case ANIME ->
              aniListService.searchAnime(query, page).stream().map(mapper::toResult).toList();
          case MANGA ->
              aniListService.searchManga(query, page).stream()
                  .map(item -> mapper.toResult(item, MediaType.MANGA))
                  .toList();
          case WEBTOON ->
              aniListService.searchWebtoons(query, page).stream()
                  .map(item -> mapper.toResult(item, MediaType.WEBTOON))
                  .toList();
          default -> List.of();
        };
    return new CachedSearchPage(results, results.size() == ANILIST_PAGE_SIZE);
  }

  private static ProviderSearchResult unavailable(String provider) {
    return new ProviderSearchResult(provider, List.of(), false, true);
  }

  private record ProviderSearchResult(
      String provider,
      List<SearchResultResponseDto> results,
      boolean hasMore,
      boolean isUnavailable) {}
}
