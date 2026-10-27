package com.shelfy.api.igdb.client;

import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.common.http.ProviderCall;
import com.shelfy.api.common.http.ProviderCall.Provider;
import com.shelfy.api.igdb.IgdbProperties;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
@RequiredArgsConstructor
public class IgdbClient {

  private static final Provider IGDB =
      new Provider("IGDB", ErrorCode.IGDB_RESOURCE_NOT_FOUND, ErrorCode.IGDB_PROVIDER_UNAVAILABLE);
  public static final long EROTIC_THEME_ID = 42;
  private static final String EROTIC_THEME_EXCLUSION = "themes != (42)";
  private static final String NO_EXCLUSION = "id != null";
  private static final String CLIENT_ID_HEADER = "Client-ID";
  private static final int STEAM_EXTERNAL_GAME_SOURCE = 1;
  private static final int PAGE_SIZE = 50;
  public static final int SEARCH_PAGE_SIZE = 20;
  public static final int TOP_RATED_MIN_RATINGS = 300;
  public static final int NEW_RELEASE_WINDOW_DAYS = 120;
  public static final int UPCOMING_WINDOW_DAYS = 240;
  private static final int FACET_LIMIT = 200;
  private static final String EXPLORE_FIELDS =
      "fields id,name,summary,first_release_date,cover.url,screenshots.url,genres.name,"
          + "platforms.name,themes.id,themes.name,total_rating,total_rating_count;";
  private static final int PAGED_REQUEST_LIMIT = PAGE_SIZE + 1;

  private final RestClient igdbRestClient;
  private final IgdbProperties properties;
  private final IgdbTokenProvider tokenProvider;

  public List<IgdbGameResponseDto> searchGames(String query, boolean includeAdult, int page) {
    String body =
        IgdbQueries.SEARCH_GAMES.formatted(
            escape(query),
            includeAdult ? NO_EXCLUSION : EROTIC_THEME_EXCLUSION,
            SEARCH_PAGE_SIZE,
            (page - 1) * SEARCH_PAGE_SIZE);
    return post(body);
  }

  public List<IgdbGameResponseDto> fetchTrendingGames(int limit) {
    long oneYearAgo = Instant.now().minus(365, ChronoUnit.DAYS).getEpochSecond();
    String body = IgdbQueries.TRENDING_GAMES.formatted(oneYearAgo, EROTIC_THEME_EXCLUSION, limit);
    return post(body);
  }

  public List<IgdbGameResponseDto> fetchTopRatedGames(int minRatingCount, int limit) {
    return post(
        IgdbQueries.TOP_RATED_GAMES.formatted(minRatingCount, EROTIC_THEME_EXCLUSION, limit));
  }

  public List<IgdbGameResponseDto> fetchNewGames(Instant from, Instant to, int limit) {
    return post(
        IgdbQueries.NEW_GAMES.formatted(
            from.getEpochSecond(), to.getEpochSecond(), EROTIC_THEME_EXCLUSION, limit));
  }

  public List<IgdbGameResponseDto> fetchUpcomingGames(Instant from, Instant to, int limit) {
    return post(
        IgdbQueries.UPCOMING_GAMES.formatted(
            from.getEpochSecond(), to.getEpochSecond(), EROTIC_THEME_EXCLUSION, limit));
  }

  public IgdbGameResponseDto fetchGame(long id) {
    String body = IgdbQueries.GAME_BY_ID.formatted(id);
    List<IgdbGameResponseDto> games = post(body);
    if (games.isEmpty()) {
      throw new ResourceNotFoundException(ErrorCode.IGDB_RESOURCE_NOT_FOUND, "IGDB game not found");
    }
    return games.getFirst();
  }

  public IgdbGameResponseDto fetchGameRelated(long id) {
    List<IgdbGameResponseDto> games = post(IgdbQueries.GAME_RELATED.formatted(id));
    if (games.isEmpty()) {
      throw new ResourceNotFoundException(ErrorCode.IGDB_RESOURCE_NOT_FOUND, "IGDB game not found");
    }
    return games.getFirst();
  }

  public List<IgdbGameResponseDto> fetchFranchiseTopGames(long franchiseId, long excludeId) {
    return post(
        IgdbQueries.FRANCHISE_TOP_GAMES.formatted(
            franchiseId, franchiseId, excludeId, EROTIC_THEME_EXCLUSION));
  }

  public List<IgdbGameResponseDto> fetchDeveloperTopGames(long companyId) {
    List<Long> involvedIds = fetchInvolvedCompanyIds(companyId, true);
    if (involvedIds.isEmpty()) {
      return List.of();
    }
    String ids = involvedIds.stream().map(String::valueOf).collect(Collectors.joining(","));
    return post(IgdbQueries.TOP_GAMES_BY_INVOLVED_COMPANIES.formatted(ids, EROTIC_THEME_EXCLUSION));
  }

  public List<IgdbGameResponseDto> fetchGamesByIds(List<Long> ids) {
    if (ids.isEmpty()) {
      return List.of();
    }
    String idList = ids.stream().map(String::valueOf).collect(Collectors.joining(","));
    String body = IgdbQueries.GAMES_BY_ID.formatted(idList, ids.size());
    return post(body);
  }

  public List<IgdbGameResponseDto> fetchDlcGames(long baseGameId) {
    String body = IgdbQueries.DLC_GAMES.formatted(baseGameId, EROTIC_THEME_EXCLUSION);
    return post(body);
  }

  public Optional<IgdbFranchiseResponseDto> findFranchise(long id) {
    String body = IgdbQueries.FRANCHISE_BY_ID.formatted(id);
    List<IgdbFranchiseResponseDto> franchises =
        post(
            "/franchises",
            body,
            new ParameterizedTypeReference<List<IgdbFranchiseResponseDto>>() {});
    return franchises.stream().findFirst();
  }

  public List<IgdbExternalGameResponseDto> fetchExternalGamesBySteamAppId(List<Long> steamAppIds) {
    String uids = steamAppIds.stream().map(id -> "\"" + id + "\"").collect(Collectors.joining(","));
    String body =
        IgdbQueries.EXTERNAL_GAMES_BY_STEAM_APP_ID.formatted(uids, STEAM_EXTERNAL_GAME_SOURCE);
    return post(
        "/external_games",
        body,
        new ParameterizedTypeReference<List<IgdbExternalGameResponseDto>>() {});
  }

  public Optional<IgdbCompanyDetailResponseDto> findCompany(long id) {
    String body = IgdbQueries.COMPANY_BY_ID.formatted(id);
    List<IgdbCompanyDetailResponseDto> companies =
        post(
            "/companies",
            body,
            new ParameterizedTypeReference<List<IgdbCompanyDetailResponseDto>>() {});
    return companies.stream().findFirst();
  }

  public List<Long> fetchInvolvedCompanyIds(long companyId, boolean developer) {
    String developerFlag = developer ? "true" : "false";
    String body = IgdbQueries.INVOLVED_COMPANY_IDS.formatted(companyId, developerFlag);
    List<IgdbInvolvedCompanyIdResponseDto> ids =
        post(
            "/involved_companies",
            body,
            new ParameterizedTypeReference<List<IgdbInvolvedCompanyIdResponseDto>>() {});
    return ids.stream().map(IgdbInvolvedCompanyIdResponseDto::id).toList();
  }

  public List<IgdbGameResponseDto> fetchGamesByInvolvedCompanies(
      List<Long> icIds, boolean includeAdult, int page) {
    if (icIds == null || icIds.isEmpty()) {
      return List.of();
    }
    String ids = icIds.stream().map(id -> Long.toString(id)).collect(Collectors.joining(","));
    String exclusion = includeAdult ? NO_EXCLUSION : EROTIC_THEME_EXCLUSION;
    int offset = page * PAGE_SIZE;
    String body =
        IgdbQueries.GAMES_BY_INVOLVED_COMPANIES.formatted(
            ids, exclusion, PAGED_REQUEST_LIMIT, offset);
    return post(body);
  }

  public List<IgdbGameResponseDto> fetchFranchiseGamesPaged(
      long franchiseId, boolean includeAdult, int page) {
    String exclusion = includeAdult ? NO_EXCLUSION : EROTIC_THEME_EXCLUSION;
    int offset = page * PAGE_SIZE;
    String body =
        IgdbQueries.FRANCHISE_GAMES_PAGED.formatted(
            franchiseId, franchiseId, exclusion, PAGED_REQUEST_LIMIT, offset);
    return post(body);
  }

  public List<IgdbGameResponseDto> fetchGamesByFacet(
      String field, long facetId, boolean includeAdult, int page) {
    String exclusion = includeAdult ? NO_EXCLUSION : EROTIC_THEME_EXCLUSION;
    int offset = page * PAGE_SIZE;
    String body =
        IgdbQueries.GAMES_BY_FACET.formatted(
            field, facetId, exclusion, PAGED_REQUEST_LIMIT, offset);
    return post(body);
  }

  private List<IgdbGameResponseDto> post(String body) {
    return post("/games", body, new ParameterizedTypeReference<List<IgdbGameResponseDto>>() {});
  }

  private <T> List<T> post(String endpoint, String body, ParameterizedTypeReference<List<T>> type) {
    List<T> result =
        ProviderCall.execute(
            IGDB,
            endpoint,
            () ->
                igdbRestClient
                    .post()
                    .uri(endpoint)
                    .header(CLIENT_ID_HEADER, properties.clientId())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.getAccessToken())
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(body)
                    .retrieve()
                    .body(type));
    return result == null ? List.of() : result;
  }

  private static String escape(String value) {
    return value.replace("\\", "\\\\").replace("\"", "\\\"");
  }

  public List<IgdbGameResponseDto> explore(IgdbExploreQuery query) {
    List<String> conditions = new ArrayList<>();
    conditions.add(query.includeAdult() ? NO_EXCLUSION : EROTIC_THEME_EXCLUSION);
    conditions.add("cover != null");
    conditions.add("version_parent = null");
    containsAll(conditions, "genres", query.genres());
    containsAll(conditions, "themes", query.themes());
    containsAll(conditions, "keywords", query.keywords());
    containsAny(conditions, "platforms", query.platforms());
    containsNone(conditions, "genres", query.withoutGenres());
    containsNone(conditions, "themes", query.withoutThemes());
    containsNone(conditions, "keywords", query.withoutKeywords());
    boolean searching = query.search() != null && !query.search().isBlank();
    Long releasedFrom = query.releasedFrom();
    Long releasedTo = query.releasedTo();
    if (!searching && query.sort() == IgdbExploreQuery.Sort.RECENT) {
      long now = Instant.now().getEpochSecond();
      long windowStart =
          Instant.now().minus(NEW_RELEASE_WINDOW_DAYS, ChronoUnit.DAYS).getEpochSecond();
      releasedFrom = releasedFrom == null ? windowStart : Math.max(releasedFrom, windowStart);
      releasedTo = releasedTo == null ? now : Math.min(releasedTo, now);
    }
    if (releasedFrom != null) {
      conditions.add("first_release_date >= " + releasedFrom);
    }
    if (releasedTo != null) {
      conditions.add("first_release_date <= " + releasedTo);
    }
    if (!searching && query.sort() == IgdbExploreQuery.Sort.RATING) {
      conditions.add("total_rating_count >= " + TOP_RATED_MIN_RATINGS);
      conditions.add("game_type = (0,8)");
    }
    StringBuilder body = new StringBuilder();
    if (searching) {
      body.append("search \"").append(escape(query.search())).append("\"; ");
    }
    body.append(EXPLORE_FIELDS)
        .append(" where ")
        .append(String.join(" & ", conditions))
        .append(';');
    if (!searching) {
      body.append(" sort ").append(sortField(query.sort())).append(" desc;");
    }
    body.append(" limit ")
        .append(query.limit())
        .append("; offset ")
        .append(query.offset())
        .append(';');
    return post(body.toString());
  }

  public List<IgdbFacetResponseDto> fetchFacets(String endpoint, String search) {
    String condition =
        search == null || search.isBlank() ? "" : "where name ~ *\"" + escape(search) + "\"*; ";
    return post(
        endpoint,
        "fields id,name; " + condition + "sort name asc; limit " + FACET_LIMIT + ";",
        new ParameterizedTypeReference<List<IgdbFacetResponseDto>>() {});
  }

  public List<IgdbFacetResponseDto> fetchKeywordsBySlug(List<String> slugs) {
    String values =
        slugs.stream().map(slug -> "\"" + escape(slug) + "\"").collect(Collectors.joining(","));
    return post(
        "/keywords",
        "fields id,name,slug; where slug = (" + values + "); limit " + slugs.size() + ";",
        new ParameterizedTypeReference<List<IgdbFacetResponseDto>>() {});
  }

  private static String sortField(IgdbExploreQuery.Sort sort) {
    return switch (sort) {
      case POPULAR -> "total_rating_count";
      case RATING -> "total_rating";
      case RECENT -> "first_release_date";
    };
  }

  private static void containsAll(List<String> conditions, String field, List<Long> ids) {
    if (!ids.isEmpty()) {
      conditions.add(field + " = [" + joinIds(ids) + "]");
    }
  }

  private static void containsAny(List<String> conditions, String field, List<Long> ids) {
    if (!ids.isEmpty()) {
      conditions.add(field + " = (" + joinIds(ids) + ")");
    }
  }

  private static void containsNone(List<String> conditions, String field, List<Long> ids) {
    if (!ids.isEmpty()) {
      conditions.add(field + " != (" + joinIds(ids) + ")");
    }
  }

  private static String joinIds(List<Long> ids) {
    return ids.stream().map(String::valueOf).collect(Collectors.joining(","));
  }
}
