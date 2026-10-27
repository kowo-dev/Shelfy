package com.shelfy.api.tmdb;

import com.shelfy.api.common.cache.ProviderCache;
import com.shelfy.api.common.cache.ProviderCacheSpace;
import com.shelfy.api.common.dto.NextAiringDto;
import com.shelfy.api.config.CacheConfig;
import com.shelfy.api.tmdb.client.TmdbClient;
import com.shelfy.api.tmdb.client.TmdbDiscoverQuery;
import com.shelfy.api.tmdb.client.TmdbKeywordResponseDto;
import com.shelfy.api.tmdb.client.TmdbMovieResponseDto;
import com.shelfy.api.tmdb.client.TmdbTvShowResponseDto;
import com.shelfy.api.tmdb.dto.CompanyDetailResponseDto;
import com.shelfy.api.tmdb.dto.MovieDetailResponseDto;
import com.shelfy.api.tmdb.dto.MovieSummaryResponseDto;
import com.shelfy.api.tmdb.dto.PersonDetailResponseDto;
import com.shelfy.api.tmdb.dto.SeasonDetailResponseDto;
import com.shelfy.api.tmdb.dto.TmdbGenreDto;
import com.shelfy.api.tmdb.dto.TmdbKeywordDto;
import com.shelfy.api.tmdb.dto.TmdbSearchResponseDto;
import com.shelfy.api.tmdb.dto.TvShowDetailResponseDto;
import com.shelfy.api.tmdb.dto.TvShowSummaryResponseDto;
import com.shelfy.api.tmdb.dto.WatchProviderDto;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.IntFunction;
import java.util.stream.IntStream;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TmdbService {

  private static final int ANIMATION_GENRE_ID = 16;
  private static final String JAPAN_ORIGIN_COUNTRY = "JP";

  private final TmdbClient tmdbClient;
  private final ProviderCache providerCache;

  public TmdbSearchResponseDto<MovieSummaryResponseDto> searchMovies(
      String query, int page, boolean includeAdult) {
    var payload = tmdbClient.searchMovies(query, page, includeAdult);
    return new TmdbSearchResponseDto<>(
        payload.results().stream().map(TmdbMapper::toMovieSummary).toList(),
        payload.page(),
        payload.totalPages(),
        payload.totalResults());
  }

  public TmdbSearchResponseDto<TvShowSummaryResponseDto> searchTvShows(
      String query, int page, boolean includeAdult) {
    var payload = tmdbClient.searchTvShows(query, page, includeAdult);
    List<TvShowSummaryResponseDto> results =
        payload.results().stream()
            .filter(show -> !isJapaneseAnimation(show))
            .map(TmdbMapper::toTvShowSummary)
            .toList();
    return new TmdbSearchResponseDto<>(
        results, payload.page(), payload.totalPages(), payload.totalResults());
  }

  public TmdbSearchResponseDto<MovieSummaryResponseDto> discoverMovies(TmdbDiscoverQuery query) {
    var payload = tmdbClient.discoverMovies(query);
    return new TmdbSearchResponseDto<>(
        payload.results().stream().map(TmdbMapper::toMovieSummary).toList(),
        payload.page(),
        payload.totalPages(),
        payload.totalResults());
  }

  public TmdbSearchResponseDto<TvShowSummaryResponseDto> discoverTvShows(TmdbDiscoverQuery query) {
    var payload = tmdbClient.discoverTvShows(query);
    List<TvShowSummaryResponseDto> results =
        payload.results().stream()
            .filter(show -> !isJapaneseAnimation(show))
            .map(TmdbMapper::toTvShowSummary)
            .toList();
    return new TmdbSearchResponseDto<>(
        results, payload.page(), payload.totalPages(), payload.totalResults());
  }

  public List<TmdbKeywordDto> searchKeywords(String query) {
    return tmdbClient.searchKeywords(query).results().stream()
        .map(keyword -> new TmdbKeywordDto(keyword.id(), keyword.name()))
        .toList();
  }

  @Cacheable(CacheConfig.TMDB_KEYWORD_IDS)
  public Optional<Integer> findKeywordId(String name) {
    return tmdbClient.searchKeywords(name).results().stream()
        .filter(keyword -> keyword.name().equalsIgnoreCase(name))
        .map(TmdbKeywordResponseDto::id)
        .findFirst();
  }

  @Cacheable(CacheConfig.TMDB_WATCH_PROVIDERS)
  public List<WatchProviderDto> getWatchProviders(String region) {
    return tmdbClient.fetchWatchProviders(region).results().stream()
        .sorted(
            Comparator.comparingInt(
                provider ->
                    provider.displayPriorities() == null
                        ? Integer.MAX_VALUE
                        : provider.displayPriorities().getOrDefault(region, Integer.MAX_VALUE)))
        .map(
            provider ->
                new WatchProviderDto(
                    provider.providerId(), provider.providerName(), provider.logoPath()))
        .toList();
  }

  private static final int WIDE_PAGE_COUNT = 8;

  private static final int NEW_RELEASE_WINDOW_DAYS = TmdbClient.NEW_RELEASE_WINDOW_DAYS;
  private static final int UPCOMING_WINDOW_DAYS = TmdbClient.UPCOMING_WINDOW_DAYS;
  private static final int TOP_RATED_MOVIE_MIN_VOTES = TmdbClient.TOP_RATED_MOVIE_MIN_VOTES;
  private static final int TOP_RATED_TV_MIN_VOTES = TmdbClient.TOP_RATED_TV_MIN_VOTES;
  private static final int TOP_RATED_SETTLE_MONTHS = TmdbClient.TOP_RATED_SETTLE_MONTHS;

  public List<MovieSummaryResponseDto> getTrendingMoviesWide() {
    return moviesWide(tmdbClient::fetchTrendingMovies);
  }

  public List<MovieSummaryResponseDto> getTopRatedMoviesWide() {
    LocalDate releasedBefore = LocalDate.now().minusMonths(TOP_RATED_SETTLE_MONTHS);
    return moviesWide(
        page -> tmdbClient.fetchTopRatedMovies(TOP_RATED_MOVIE_MIN_VOTES, releasedBefore, page));
  }

  public List<MovieSummaryResponseDto> getNewMoviesWide() {
    LocalDate today = LocalDate.now();
    LocalDate from = today.minusDays(NEW_RELEASE_WINDOW_DAYS);
    return moviesWide(page -> tmdbClient.fetchNewMovies(from, today, page));
  }

  public List<MovieSummaryResponseDto> getUpcomingMoviesWide() {
    LocalDate tomorrow = LocalDate.now().plusDays(1);
    LocalDate until = tomorrow.plusDays(UPCOMING_WINDOW_DAYS);
    return moviesWide(page -> tmdbClient.fetchNewMovies(tomorrow, until, page));
  }

  public List<TvShowSummaryResponseDto> getTrendingTvShowsWide() {
    return tvShowsWide(tmdbClient::fetchTrendingTvShows);
  }

  public List<TvShowSummaryResponseDto> getTopRatedTvShowsWide() {
    LocalDate airedBefore = LocalDate.now().minusMonths(TOP_RATED_SETTLE_MONTHS);
    return tvShowsWide(
        page -> tmdbClient.fetchTopRatedTvShows(TOP_RATED_TV_MIN_VOTES, airedBefore, page));
  }

  public List<TvShowSummaryResponseDto> getNewTvShowsWide() {
    LocalDate today = LocalDate.now();
    LocalDate from = today.minusDays(NEW_RELEASE_WINDOW_DAYS);
    return tvShowsWide(page -> tmdbClient.fetchNewTvShows(from, today, page));
  }

  public List<TvShowSummaryResponseDto> getUpcomingTvShowsWide() {
    LocalDate tomorrow = LocalDate.now().plusDays(1);
    LocalDate until = tomorrow.plusDays(UPCOMING_WINDOW_DAYS);
    return tvShowsWide(page -> tmdbClient.fetchNewTvShows(tomorrow, until, page));
  }

  private List<MovieSummaryResponseDto> moviesWide(
      IntFunction<com.shelfy.api.tmdb.client.TmdbSearchResponseDto<TmdbMovieResponseDto>>
          fetchPage) {
    Set<Long> seenIds = new HashSet<>();
    return IntStream.rangeClosed(1, WIDE_PAGE_COUNT)
        .mapToObj(fetchPage)
        .flatMap(payload -> payload.results().stream())
        .filter(movie -> seenIds.add(movie.id()))
        .map(TmdbMapper::toMovieSummary)
        .toList();
  }

  private List<TvShowSummaryResponseDto> tvShowsWide(
      IntFunction<com.shelfy.api.tmdb.client.TmdbSearchResponseDto<TmdbTvShowResponseDto>>
          fetchPage) {
    Set<Long> seenIds = new HashSet<>();
    return IntStream.rangeClosed(1, WIDE_PAGE_COUNT)
        .mapToObj(fetchPage)
        .flatMap(payload -> payload.results().stream())
        .filter(show -> !isJapaneseAnimation(show))
        .filter(show -> seenIds.add(show.id()))
        .map(TmdbMapper::toTvShowSummary)
        .toList();
  }

  private static boolean isJapaneseAnimation(TmdbTvShowResponseDto show) {
    List<Integer> genreIds = show.genreIds();
    List<String> originCountry = show.originCountry();
    return genreIds != null
        && genreIds.contains(ANIMATION_GENRE_ID)
        && originCountry != null
        && originCountry.contains(JAPAN_ORIGIN_COUNTRY);
  }

  public MovieDetailResponseDto getMovie(long id) {
    return providerCache.get(
        ProviderCacheSpace.TMDB_MOVIE,
        String.valueOf(id),
        MovieDetailResponseDto.class,
        () -> TmdbMapper.toMovieDetail(tmdbClient.fetchMovie(id)));
  }

  public TvShowDetailResponseDto getTvShow(long id) {
    return providerCache.get(
        ProviderCacheSpace.TMDB_TV_SHOW,
        String.valueOf(id),
        TvShowDetailResponseDto.class,
        () -> TmdbMapper.toTvShowDetail(tmdbClient.fetchTvShow(id)));
  }

  public NextAiringDto getNextEpisode(long tvId) {
    return providerCache.get(
        ProviderCacheSpace.TMDB_TV_NEXT,
        String.valueOf(tvId),
        NextAiringDto.class,
        () -> TmdbMapper.toNextAiring(tmdbClient.fetchTvShowSummary(tvId)));
  }

  public SeasonDetailResponseDto getTvSeason(long tvId, int seasonNumber) {
    return providerCache.get(
        ProviderCacheSpace.TMDB_TV_SEASON,
        tvId + ":" + seasonNumber,
        SeasonDetailResponseDto.class,
        () -> TmdbMapper.toSeasonDetail(tmdbClient.fetchTvSeason(tvId, seasonNumber)));
  }

  public PersonDetailResponseDto getPerson(long id, boolean adultContentAllowed) {
    return TmdbMapper.toPersonDetail(tmdbClient.fetchPerson(id), adultContentAllowed);
  }

  public CompanyDetailResponseDto getCompany(long id) {
    return TmdbMapper.toCompanyDetail(tmdbClient.fetchCompany(id));
  }

  public CompanyDetailResponseDto getNetwork(long id) {
    return TmdbMapper.toCompanyDetail(tmdbClient.fetchNetwork(id));
  }

  public TmdbSearchResponseDto<MovieSummaryResponseDto> getMoviesByCompany(
      long companyId, int page) {
    var payload = tmdbClient.discoverMoviesByCompany(companyId, page);
    return new TmdbSearchResponseDto<>(
        payload.results().stream().map(TmdbMapper::toMovieSummary).toList(),
        payload.page(),
        payload.totalPages(),
        payload.totalResults());
  }

  public TmdbSearchResponseDto<TvShowSummaryResponseDto> getTvShowsByCompany(
      long companyId, int page) {
    var payload = tmdbClient.discoverTvShowsByCompany(companyId, page);
    return new TmdbSearchResponseDto<>(
        payload.results().stream().map(TmdbMapper::toTvShowSummary).toList(),
        payload.page(),
        payload.totalPages(),
        payload.totalResults());
  }

  public TmdbSearchResponseDto<TvShowSummaryResponseDto> getTvShowsByNetwork(
      long networkId, int page) {
    var payload = tmdbClient.discoverTvShowsByNetwork(networkId, page);
    return new TmdbSearchResponseDto<>(
        payload.results().stream().map(TmdbMapper::toTvShowSummary).toList(),
        payload.page(),
        payload.totalPages(),
        payload.totalResults());
  }

  public TmdbSearchResponseDto<MovieSummaryResponseDto> getMoviesByGenre(long genreId, int page) {
    var payload = tmdbClient.discoverMoviesByGenre(genreId, page);
    return new TmdbSearchResponseDto<>(
        payload.results().stream().map(TmdbMapper::toMovieSummary).toList(),
        payload.page(),
        payload.totalPages(),
        payload.totalResults());
  }

  public TmdbSearchResponseDto<TvShowSummaryResponseDto> getTvShowsByGenre(long genreId, int page) {
    var payload = tmdbClient.discoverTvShowsByGenre(genreId, page);
    return new TmdbSearchResponseDto<>(
        payload.results().stream().map(TmdbMapper::toTvShowSummary).toList(),
        payload.page(),
        payload.totalPages(),
        payload.totalResults());
  }

  @Cacheable(CacheConfig.TMDB_MOVIE_GENRES)
  public List<TmdbGenreDto> getMovieGenres() {
    return TmdbMapper.toGenres(tmdbClient.fetchMovieGenres().genres());
  }

  @Cacheable(CacheConfig.TMDB_TV_GENRES)
  public List<TmdbGenreDto> getTvGenres() {
    return TmdbMapper.toGenres(tmdbClient.fetchTvGenres().genres());
  }
}
