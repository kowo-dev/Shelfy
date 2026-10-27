package com.shelfy.api.anilist.client;

import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.common.http.ProviderCall;
import com.shelfy.api.common.http.ProviderCall.Provider;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
@RequiredArgsConstructor
public class AniListClient {
  private static final String ANIME_TYPE = "ANIME";
  public static final int ANIME_TOP_RATED_MIN_POPULARITY = 50_000;
  public static final int MANGA_TOP_RATED_MIN_POPULARITY = 30_000;
  public static final int WEBTOON_TOP_RATED_MIN_POPULARITY = 20_000;
  public static final int TOP_RATED_SETTLE_MONTHS = 12;
  public static final int NEW_RELEASE_WINDOW_DAYS = 365;
  public static final int UPCOMING_WINDOW_DAYS = 240;
  public static final List<String> ANIME_TOP_RATED_FORMATS = List.of("TV", "MOVIE", "ONA");

  private static final Provider ANILIST =
      new Provider(
          "AniList", ErrorCode.ANILIST_RESOURCE_NOT_FOUND, ErrorCode.ANILIST_PROVIDER_UNAVAILABLE);

  private final RestClient anilistRestClient;

  public List<AniListMediaResponseDto> fetchTrending(
      String type, int page, int perPage, String countryOfOrigin) {
    return pageMedia(
        AniListQueries.TRENDING_QUERY, pageVariables(type, page, perPage, countryOfOrigin));
  }

  public List<AniListMediaResponseDto> fetchTopRated(
      String type,
      int page,
      int perPage,
      String countryOfOrigin,
      int minPopularity,
      int startedBefore) {
    Map<String, Object> variables = pageVariables(type, page, perPage, countryOfOrigin);
    variables.put("minPopularity", minPopularity);
    variables.put("startedBefore", startedBefore);
    return pageMedia(AniListQueries.TOP_RATED_QUERY, variables);
  }

  public List<AniListMediaResponseDto> fetchNew(
      String type,
      int page,
      int perPage,
      String countryOfOrigin,
      int startedAfter,
      int startedBefore) {
    Map<String, Object> variables = pageVariables(type, page, perPage, countryOfOrigin);
    variables.put("startedAfter", startedAfter);
    variables.put("startedBefore", startedBefore);
    return pageMedia(AniListQueries.NEW_QUERY, variables);
  }

  public List<AniListMediaResponseDto> search(
      String type, String query, int perPage, String countryOfOrigin, int page) {
    Map<String, Object> variables = pageVariables(type, page, perPage, countryOfOrigin);
    variables.put("search", query);
    return pageMedia(AniListQueries.SEARCH_QUERY, variables);
  }

  public AniListSearchEveryFormatResponseDto.Data searchEveryFormat(
      String query, int perPage, int page) {
    Map<String, Object> variables = Map.of("search", query, "page", page, "perPage", perPage);
    AniListSearchEveryFormatResponseDto response =
        post(
            AniListQueries.SEARCH_EVERY_FORMAT_QUERY,
            variables,
            AniListSearchEveryFormatResponseDto.class);
    if (response == null || response.data() == null) {
      return new AniListSearchEveryFormatResponseDto.Data(null, null, null);
    }
    return response.data();
  }

  private static Map<String, Object> pageVariables(
      String type, int page, int perPage, String countryOfOrigin) {
    Map<String, Object> variables = new HashMap<>();
    variables.put("type", type);
    variables.put("page", page);
    variables.put("perPage", perPage);
    if (countryOfOrigin != null) {
      variables.put("countryOfOrigin", countryOfOrigin);
    }
    return variables;
  }

  private List<AniListMediaResponseDto> pageMedia(String query, Map<String, Object> variables) {
    AniListGraphQlResponseDto response = post(query, variables, AniListGraphQlResponseDto.class);
    if (response == null || response.data() == null || response.data().Page() == null) {
      return List.of();
    }
    List<AniListMediaResponseDto> media = response.data().Page().media();
    return media == null ? List.of() : media;
  }

  public AniListMediaResponseDto fetchById(long id, String type) {
    Map<String, Object> variables = Map.of("id", id, "type", type);
    AniListMediaGraphQlResponseDto response =
        post(AniListQueries.BY_ID_QUERY, variables, AniListMediaGraphQlResponseDto.class);
    if (response == null || response.data() == null || response.data().Media() == null) {
      throw new ResourceNotFoundException(
          ErrorCode.ANILIST_RESOURCE_NOT_FOUND, "AniList media not found");
    }
    return response.data().Media();
  }

  public AniListRelatedGraphQlResponseDto.Media fetchRelated(long id, int page, int perPage) {
    Map<String, Object> variables = Map.of("id", id, "page", page, "perPage", perPage);
    AniListRelatedGraphQlResponseDto response =
        post(AniListQueries.RELATED_QUERY, variables, AniListRelatedGraphQlResponseDto.class);
    if (response == null || response.data() == null || response.data().Media() == null) {
      throw new ResourceNotFoundException(
          ErrorCode.ANILIST_RESOURCE_NOT_FOUND, "AniList media not found");
    }
    return response.data().Media();
  }

  public List<AniListRelatedGraphQlResponseDto.StaffWork> fetchStaffWorks(long id) {
    AniListRelatedGraphQlResponseDto.StaffWorks response =
        post(
            AniListQueries.STAFF_WORKS_QUERY,
            Map.of("id", id),
            AniListRelatedGraphQlResponseDto.StaffWorks.class);
    if (response == null
        || response.data() == null
        || response.data().Staff() == null
        || response.data().Staff().staffMedia() == null
        || response.data().Staff().staffMedia().edges() == null) {
      return List.of();
    }
    return response.data().Staff().staffMedia().edges();
  }

  public AniListStaffGraphQlResponseDto fetchStaffById(long id, int page) {
    Map<String, Object> variables = Map.of("id", id, "page", page);
    return post(AniListQueries.STAFF_BY_ID_QUERY, variables, AniListStaffGraphQlResponseDto.class);
  }

  public AniListCharacterGraphQlResponseDto fetchCharacterById(long id) {
    Map<String, Object> variables = Map.of("id", id);
    return post(
        AniListQueries.CHARACTER_BY_ID_QUERY, variables, AniListCharacterGraphQlResponseDto.class);
  }

  public AniListStudioGraphQlResponseDto fetchStudioById(long id) {
    Map<String, Object> variables = Map.of("id", id);
    return post(
        AniListQueries.STUDIO_BY_ID_QUERY, variables, AniListStudioGraphQlResponseDto.class);
  }

  public AniListGraphQlResponseDto browseMedia(
      String type, int page, int perPage, String genre, String tag, String countryOfOrigin) {
    Map<String, Object> variables = pageVariables(type, page, perPage, countryOfOrigin);
    if (genre != null) {
      variables.put("genre", genre);
    }
    if (tag != null) {
      variables.put("tag", tag);
    }
    return post(AniListQueries.BROWSE_QUERY, variables, AniListGraphQlResponseDto.class);
  }

  private <T> T post(String query, Map<String, Object> variables, Class<T> responseType) {
    return ProviderCall.execute(
        ANILIST,
        "graphql",
        () ->
            anilistRestClient
                .post()
                .uri("")
                .contentType(MediaType.APPLICATION_JSON)
                .body(new GraphQlRequestDto(query, variables))
                .retrieve()
                .body(responseType));
  }

  public AniListPageResponseDto explore(
      String type, String countryOfOrigin, AniListExploreQuery query) {
    Map<String, Object> variables =
        pageVariables(type, query.page(), query.perPage(), countryOfOrigin);
    putIfPresent(variables, "search", blankToNull(query.search()));
    putIfPresent(variables, "genres", emptyToNull(query.genres()));
    putIfPresent(variables, "withoutGenres", emptyToNull(query.withoutGenres()));
    putIfPresent(variables, "tags", emptyToNull(query.tags()));
    putIfPresent(variables, "withoutTags", emptyToNull(query.withoutTags()));
    boolean searching = query.search() != null && !query.search().isBlank();
    putIfPresent(variables, "startedFrom", startedFrom(query, searching));
    putIfPresent(variables, "startedTo", startedTo(query, searching));
    if (!searching && query.sort() == AniListExploreQuery.Sort.RATING) {
      variables.put("minPopularity", topRatedMinPopularity(type, countryOfOrigin));
      if (ANIME_TYPE.equals(type)) {
        variables.put("formats", ANIME_TOP_RATED_FORMATS);
      }
    }
    putIfPresent(variables, "isAdult", query.includeAdult() ? null : false);
    variables.put("sort", List.of(sort(query)));
    AniListGraphQlResponseDto response =
        post(AniListQueries.EXPLORE_QUERY, variables, AniListGraphQlResponseDto.class);
    if (response == null || response.data() == null || response.data().Page() == null) {
      return new AniListPageResponseDto(List.of(), null);
    }
    AniListPageResponseDto page = response.data().Page();
    return page.media() == null ? new AniListPageResponseDto(List.of(), page.pageInfo()) : page;
  }

  public AniListCollectionsResponseDto.Data fetchCollections() {
    AniListCollectionsResponseDto response =
        post(AniListQueries.COLLECTIONS_QUERY, Map.of(), AniListCollectionsResponseDto.class);
    if (response == null || response.data() == null) {
      return new AniListCollectionsResponseDto.Data(List.of(), List.of());
    }
    return response.data();
  }

  private static String sort(AniListExploreQuery query) {
    if (query.search() != null && !query.search().isBlank()) {
      return "SEARCH_MATCH";
    }
    return switch (query.sort()) {
      case POPULAR -> "POPULARITY_DESC";
      case RATING -> "SCORE_DESC";
      case RECENT -> "START_DATE_DESC";
    };
  }

  private static int topRatedMinPopularity(String type, String countryOfOrigin) {
    if (ANIME_TYPE.equals(type)) {
      return ANIME_TOP_RATED_MIN_POPULARITY;
    }
    return "KR".equals(countryOfOrigin)
        ? WEBTOON_TOP_RATED_MIN_POPULARITY
        : MANGA_TOP_RATED_MIN_POPULARITY;
  }

  private static int fuzzy(LocalDate date) {
    return Integer.parseInt(date.format(DateTimeFormatter.BASIC_ISO_DATE));
  }

  private static Integer startedFrom(AniListExploreQuery query, boolean searching) {
    if (searching || query.sort() != AniListExploreQuery.Sort.RECENT) {
      return query.startedFrom();
    }
    int windowStart = fuzzy(LocalDate.now().minusDays(NEW_RELEASE_WINDOW_DAYS));
    return query.startedFrom() == null ? windowStart : Math.max(query.startedFrom(), windowStart);
  }

  private static Integer startedTo(AniListExploreQuery query, boolean searching) {
    if (searching) {
      return query.startedTo();
    }
    if (query.sort() == AniListExploreQuery.Sort.RATING) {
      int settled = fuzzy(LocalDate.now().minusMonths(TOP_RATED_SETTLE_MONTHS));
      return query.startedTo() == null ? settled : Math.min(query.startedTo(), settled);
    }
    if (query.sort() != AniListExploreQuery.Sort.RECENT) {
      return query.startedTo();
    }
    int tomorrow = fuzzy(LocalDate.now().plusDays(1));
    return query.startedTo() == null ? tomorrow : Math.min(query.startedTo(), tomorrow);
  }

  private static void putIfPresent(Map<String, Object> variables, String name, Object value) {
    if (value != null) {
      variables.put(name, value);
    }
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }

  private static List<String> emptyToNull(List<String> values) {
    return values.isEmpty() ? null : values;
  }
}
