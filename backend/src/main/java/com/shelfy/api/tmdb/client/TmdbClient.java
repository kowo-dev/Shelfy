package com.shelfy.api.tmdb.client;

import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.http.ProviderCall;
import com.shelfy.api.common.http.ProviderCall.Provider;
import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriBuilder;

@Service
@RequiredArgsConstructor
public class TmdbClient {

  private static final Provider TMDB =
      new Provider("TMDB", ErrorCode.TMDB_RESOURCE_NOT_FOUND, ErrorCode.TMDB_PROVIDER_UNAVAILABLE);

  public static final int TOP_RATED_MOVIE_MIN_VOTES = 3_000;
  public static final int TOP_RATED_TV_MIN_VOTES = 1_500;
  public static final int TOP_RATED_SETTLE_MONTHS = 6;
  public static final int NEW_RELEASE_WINDOW_DAYS = 90;
  public static final int UPCOMING_WINDOW_DAYS = 180;

  private final RestClient tmdbRestClient;

  public TmdbSearchResponseDto<TmdbMovieResponseDto> searchMovies(
      String query, int page, boolean includeAdult) {
    return get(
        uriBuilder ->
            uriBuilder
                .path("/search/movie")
                .queryParam("query", query)
                .queryParam("page", page)
                .queryParam("include_adult", includeAdult)
                .build(),
        new ParameterizedTypeReference<TmdbSearchResponseDto<TmdbMovieResponseDto>>() {});
  }

  public TmdbSearchResponseDto<TmdbTvShowResponseDto> searchTvShows(
      String query, int page, boolean includeAdult) {
    return get(
        uriBuilder ->
            uriBuilder
                .path("/search/tv")
                .queryParam("query", query)
                .queryParam("page", page)
                .queryParam("include_adult", includeAdult)
                .build(),
        new ParameterizedTypeReference<TmdbSearchResponseDto<TmdbTvShowResponseDto>>() {});
  }

  public TmdbSearchResponseDto<TmdbMovieResponseDto> fetchTrendingMovies(int page) {
    return get(
        uriBuilder -> uriBuilder.path("/trending/movie/week").queryParam("page", page).build(),
        new ParameterizedTypeReference<TmdbSearchResponseDto<TmdbMovieResponseDto>>() {});
  }

  public TmdbSearchResponseDto<TmdbTvShowResponseDto> fetchTrendingTvShows(int page) {
    return get(
        uriBuilder -> uriBuilder.path("/trending/tv/week").queryParam("page", page).build(),
        new ParameterizedTypeReference<TmdbSearchResponseDto<TmdbTvShowResponseDto>>() {});
  }

  public TmdbSearchResponseDto<TmdbMovieResponseDto> fetchTopRatedMovies(
      int minVotes, LocalDate releasedBefore, int page) {
    return get(
        uriBuilder ->
            uriBuilder
                .path("/discover/movie")
                .queryParam("sort_by", "vote_average.desc")
                .queryParam("vote_count.gte", minVotes)
                .queryParam("primary_release_date.lte", releasedBefore)
                .queryParam("include_adult", false)
                .queryParam("page", page)
                .build(),
        new ParameterizedTypeReference<TmdbSearchResponseDto<TmdbMovieResponseDto>>() {});
  }

  public TmdbSearchResponseDto<TmdbTvShowResponseDto> fetchTopRatedTvShows(
      int minVotes, LocalDate airedBefore, int page) {
    return get(
        uriBuilder ->
            uriBuilder
                .path("/discover/tv")
                .queryParam("sort_by", "vote_average.desc")
                .queryParam("vote_count.gte", minVotes)
                .queryParam("first_air_date.lte", airedBefore)
                .queryParam("include_adult", false)
                .queryParam("page", page)
                .build(),
        new ParameterizedTypeReference<TmdbSearchResponseDto<TmdbTvShowResponseDto>>() {});
  }

  public TmdbSearchResponseDto<TmdbMovieResponseDto> fetchNewMovies(
      LocalDate from, LocalDate to, int page) {
    return get(
        uriBuilder ->
            uriBuilder
                .path("/discover/movie")
                .queryParam("primary_release_date.gte", from)
                .queryParam("primary_release_date.lte", to)
                .queryParam("sort_by", "popularity.desc")
                .queryParam("include_adult", false)
                .queryParam("page", page)
                .build(),
        new ParameterizedTypeReference<TmdbSearchResponseDto<TmdbMovieResponseDto>>() {});
  }

  public TmdbSearchResponseDto<TmdbTvShowResponseDto> fetchNewTvShows(
      LocalDate from, LocalDate to, int page) {
    return get(
        uriBuilder ->
            uriBuilder
                .path("/discover/tv")
                .queryParam("first_air_date.gte", from)
                .queryParam("first_air_date.lte", to)
                .queryParam("sort_by", "popularity.desc")
                .queryParam("include_adult", false)
                .queryParam("page", page)
                .build(),
        new ParameterizedTypeReference<TmdbSearchResponseDto<TmdbTvShowResponseDto>>() {});
  }

  public TmdbMovieResponseDto fetchMovie(long id) {
    return get(
        uriBuilder ->
            uriBuilder
                .path("/movie/{id}")
                .queryParam("append_to_response", "credits,images,videos")
                .queryParam("include_image_language", "null")
                .build(id),
        new ParameterizedTypeReference<TmdbMovieResponseDto>() {});
  }

  public TmdbTvShowResponseDto fetchTvShow(long id) {
    return get(
        uriBuilder ->
            uriBuilder
                .path("/tv/{id}")
                .queryParam("append_to_response", "credits,images,videos")
                .queryParam("include_image_language", "null")
                .build(id),
        new ParameterizedTypeReference<TmdbTvShowResponseDto>() {});
  }

  public TmdbTvShowResponseDto fetchTvShowSummary(long id) {
    return get(
        uriBuilder -> uriBuilder.path("/tv/{id}").build(id),
        new ParameterizedTypeReference<TmdbTvShowResponseDto>() {});
  }

  public TmdbMovieResponseDto fetchMovieWithRecommendations(long id) {
    return get(
        uriBuilder ->
            uriBuilder
                .path("/movie/{id}")
                .queryParam("append_to_response", "credits,recommendations")
                .build(id),
        new ParameterizedTypeReference<TmdbMovieResponseDto>() {});
  }

  public TmdbTvShowResponseDto fetchTvShowWithRecommendations(long id) {
    return get(
        uriBuilder ->
            uriBuilder
                .path("/tv/{id}")
                .queryParam("append_to_response", "recommendations")
                .build(id),
        new ParameterizedTypeReference<TmdbTvShowResponseDto>() {});
  }

  public TmdbSearchResponseDto<TmdbMovieResponseDto> fetchMovieRecommendations(long id, int page) {
    return get(
        uriBuilder ->
            uriBuilder.path("/movie/{id}/recommendations").queryParam("page", page).build(id),
        new ParameterizedTypeReference<TmdbSearchResponseDto<TmdbMovieResponseDto>>() {});
  }

  public TmdbSearchResponseDto<TmdbTvShowResponseDto> fetchTvShowRecommendations(
      long id, int page) {
    return get(
        uriBuilder ->
            uriBuilder.path("/tv/{id}/recommendations").queryParam("page", page).build(id),
        new ParameterizedTypeReference<TmdbSearchResponseDto<TmdbTvShowResponseDto>>() {});
  }

  public TmdbCollectionResponseDto fetchCollection(long id) {
    return get(
        uriBuilder -> uriBuilder.path("/collection/{id}").build(id),
        new ParameterizedTypeReference<TmdbCollectionResponseDto>() {});
  }

  public TmdbSeasonDetailResponseDto fetchTvSeason(long tvId, int seasonNumber) {
    return get(
        uriBuilder -> uriBuilder.path("/tv/{tvId}/season/{seasonNumber}").build(tvId, seasonNumber),
        new ParameterizedTypeReference<TmdbSeasonDetailResponseDto>() {});
  }

  public TmdbPersonResponseDto fetchPerson(long id) {
    return get(
        uriBuilder ->
            uriBuilder
                .path("/person/{id}")
                .queryParam("append_to_response", "combined_credits")
                .build(id),
        new ParameterizedTypeReference<TmdbPersonResponseDto>() {});
  }

  public TmdbCompanyDetailResponseDto fetchCompany(long id) {
    return get(
        uriBuilder -> uriBuilder.path("/company/{id}").build(id),
        new ParameterizedTypeReference<TmdbCompanyDetailResponseDto>() {});
  }

  public TmdbCompanyDetailResponseDto fetchNetwork(long id) {
    return get(
        uriBuilder -> uriBuilder.path("/network/{id}").build(id),
        new ParameterizedTypeReference<TmdbCompanyDetailResponseDto>() {});
  }

  public TmdbSearchResponseDto<TmdbMovieResponseDto> discoverMoviesByCompany(
      long companyId, int page) {
    return discoverMovies("with_companies", companyId, page);
  }

  public TmdbSearchResponseDto<TmdbTvShowResponseDto> discoverTvShowsByCompany(
      long companyId, int page) {
    return discoverTvShows("with_companies", companyId, page);
  }

  public TmdbSearchResponseDto<TmdbTvShowResponseDto> discoverTvShowsByNetwork(
      long networkId, int page) {
    return discoverTvShows("with_networks", networkId, page);
  }

  public TmdbSearchResponseDto<TmdbMovieResponseDto> discoverMoviesByGenre(long genreId, int page) {
    return discoverMovies("with_genres", genreId, page);
  }

  public TmdbSearchResponseDto<TmdbTvShowResponseDto> discoverTvShowsByGenre(
      long genreId, int page) {
    return discoverTvShows("with_genres", genreId, page);
  }

  private TmdbSearchResponseDto<TmdbMovieResponseDto> discoverMovies(
      String filter, long value, int page) {
    return get(
        uriBuilder ->
            uriBuilder
                .path("/discover/movie")
                .queryParam(filter, value)
                .queryParam("sort_by", "popularity.desc")
                .queryParam("include_adult", false)
                .queryParam("page", page)
                .build(),
        new ParameterizedTypeReference<TmdbSearchResponseDto<TmdbMovieResponseDto>>() {});
  }

  private TmdbSearchResponseDto<TmdbTvShowResponseDto> discoverTvShows(
      String filter, long value, int page) {
    return get(
        uriBuilder ->
            uriBuilder
                .path("/discover/tv")
                .queryParam(filter, value)
                .queryParam("sort_by", "popularity.desc")
                .queryParam("include_adult", false)
                .queryParam("page", page)
                .build(),
        new ParameterizedTypeReference<TmdbSearchResponseDto<TmdbTvShowResponseDto>>() {});
  }

  public TmdbGenreListResponseDto fetchMovieGenres() {
    return get(
        uriBuilder -> uriBuilder.path("/genre/movie/list").build(),
        new ParameterizedTypeReference<TmdbGenreListResponseDto>() {});
  }

  public TmdbGenreListResponseDto fetchTvGenres() {
    return get(
        uriBuilder -> uriBuilder.path("/genre/tv/list").build(),
        new ParameterizedTypeReference<TmdbGenreListResponseDto>() {});
  }

  public TmdbSearchResponseDto<TmdbMovieResponseDto> discoverMovies(TmdbDiscoverQuery query) {
    return get(
        uriBuilder -> discoverUri(uriBuilder, "/discover/movie", "primary_release_date", query),
        new ParameterizedTypeReference<TmdbSearchResponseDto<TmdbMovieResponseDto>>() {});
  }

  public TmdbSearchResponseDto<TmdbTvShowResponseDto> discoverTvShows(TmdbDiscoverQuery query) {
    return get(
        uriBuilder -> discoverUri(uriBuilder, "/discover/tv", "first_air_date", query),
        new ParameterizedTypeReference<TmdbSearchResponseDto<TmdbTvShowResponseDto>>() {});
  }

  public TmdbSearchResponseDto<TmdbKeywordResponseDto> searchKeywords(String query) {
    return get(
        uriBuilder -> uriBuilder.path("/search/keyword").queryParam("query", query).build(),
        new ParameterizedTypeReference<TmdbSearchResponseDto<TmdbKeywordResponseDto>>() {});
  }

  public TmdbWatchProviderListResponseDto fetchWatchProviders(String region) {
    return get(
        uriBuilder ->
            uriBuilder.path("/watch/providers/movie").queryParam("watch_region", region).build(),
        new ParameterizedTypeReference<TmdbWatchProviderListResponseDto>() {});
  }

  private static URI discoverUri(
      UriBuilder uriBuilder, String path, String dateField, TmdbDiscoverQuery query) {
    uriBuilder
        .path(path)
        .queryParam("page", query.page())
        .queryParam("include_adult", query.includeAdult())
        .queryParam("sort_by", sortBy(query.sort(), dateField));
    addList(uriBuilder, "with_genres", query.genres(), ",");
    addList(uriBuilder, "without_genres", query.withoutGenres(), ",");
    addList(uriBuilder, "with_keywords", query.keywords(), ",");
    addList(uriBuilder, "without_keywords", query.withoutKeywords(), ",");
    if (!query.watchProviders().isEmpty()) {
      addList(uriBuilder, "with_watch_providers", query.watchProviders(), "|");
      uriBuilder
          .queryParam("watch_region", query.watchRegion())
          .queryParam("with_watch_monetization_types", "flatrate|free|ads");
    }
    LocalDate today = LocalDate.now();
    LocalDate releasedFrom = query.releasedFrom();
    LocalDate releasedTo = query.releasedTo();
    if (query.sort() == TmdbDiscoverQuery.Sort.RECENT) {
      LocalDate windowStart = today.minusDays(NEW_RELEASE_WINDOW_DAYS);
      releasedFrom =
          releasedFrom == null || releasedFrom.isBefore(windowStart) ? windowStart : releasedFrom;
      releasedTo = releasedTo == null || releasedTo.isAfter(today) ? today : releasedTo;
    }
    if (query.sort() == TmdbDiscoverQuery.Sort.RATING) {
      LocalDate settled = today.minusMonths(TOP_RATED_SETTLE_MONTHS);
      releasedTo = releasedTo == null || releasedTo.isAfter(settled) ? settled : releasedTo;
      uriBuilder.queryParam(
          "vote_count.gte",
          path.contains("movie") ? TOP_RATED_MOVIE_MIN_VOTES : TOP_RATED_TV_MIN_VOTES);
    }
    if (releasedFrom != null) {
      uriBuilder.queryParam(dateField + ".gte", releasedFrom);
    }
    if (releasedTo != null) {
      uriBuilder.queryParam(dateField + ".lte", releasedTo);
    }
    return uriBuilder.build();
  }

  private static String sortBy(TmdbDiscoverQuery.Sort sort, String dateField) {
    return switch (sort) {
      case POPULAR -> "popularity.desc";
      case RATING -> "vote_average.desc";
      case RECENT -> dateField + ".desc";
    };
  }

  private static void addList(
      UriBuilder uriBuilder, String name, List<Integer> values, String separator) {
    if (!values.isEmpty()) {
      uriBuilder.queryParam(
          name, values.stream().map(String::valueOf).collect(Collectors.joining(separator)));
    }
  }

  private <T> T get(Function<UriBuilder, URI> uriFunction, ParameterizedTypeReference<T> type) {
    return ProviderCall.execute(
        TMDB, "api", () -> tmdbRestClient.get().uri(uriFunction).retrieve().body(type));
  }
}
