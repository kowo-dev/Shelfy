package com.shelfy.api.anilist;

import com.shelfy.api.anilist.client.AniListClient;
import com.shelfy.api.anilist.client.AniListCollectionsResponseDto;
import com.shelfy.api.anilist.client.AniListExploreQuery;
import com.shelfy.api.anilist.client.AniListMediaConnectionResponseDto;
import com.shelfy.api.anilist.client.AniListMediaEdgeResponseDto;
import com.shelfy.api.anilist.client.AniListMediaResponseDto;
import com.shelfy.api.anilist.client.AniListPageResponseDto;
import com.shelfy.api.anilist.client.AniListSearchEveryFormatResponseDto;
import com.shelfy.api.anilist.client.AniListStaffDetailResponseDto;
import com.shelfy.api.anilist.dto.AniListEntityMediaResponseDto;
import com.shelfy.api.anilist.dto.AniListSearchResultsDto;
import com.shelfy.api.anilist.dto.AnimeDetailResponseDto;
import com.shelfy.api.anilist.dto.AnimeSummaryResponseDto;
import com.shelfy.api.anilist.dto.BrowseMediaResponseDto;
import com.shelfy.api.anilist.dto.ExploredMangaDto;
import com.shelfy.api.anilist.dto.MangaDetailResponseDto;
import com.shelfy.api.anilist.dto.MangaOrigin;
import com.shelfy.api.anilist.dto.MangaSummaryResponseDto;
import com.shelfy.api.anilist.dto.PersonDetailResponseDto;
import com.shelfy.api.anilist.dto.StudioDetailResponseDto;
import com.shelfy.api.common.cache.ProviderCache;
import com.shelfy.api.common.cache.ProviderCacheSpace;
import com.shelfy.api.common.dto.NextAiringDto;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.config.CacheConfig;
import com.shelfy.api.igdb.dto.MediaPageResponseDto;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.IntFunction;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class AniListService {

  private static final int STAFF_TARGET_WORKS = 24;
  private static final int STAFF_MAX_CREDIT_PAGES = 4;

  private static final String ANIME_TYPE = "ANIME";
  private static final String MANGA_TYPE = "MANGA";
  private static final int TRENDING_PER_PAGE = 20;
  private static final String MANGA_COUNTRY_OF_ORIGIN = "JP";
  private static final String WEBTOON_COUNTRY_OF_ORIGIN = "KR";
  private static final int WIDE_PER_PAGE = 50;
  private static final int WIDE_PAGE_COUNT = 3;
  private static final int ANIME_TOP_RATED_MIN_POPULARITY =
      AniListClient.ANIME_TOP_RATED_MIN_POPULARITY;
  private static final int MANGA_TOP_RATED_MIN_POPULARITY =
      AniListClient.MANGA_TOP_RATED_MIN_POPULARITY;
  private static final int WEBTOON_TOP_RATED_MIN_POPULARITY =
      AniListClient.WEBTOON_TOP_RATED_MIN_POPULARITY;
  private static final int TOP_RATED_SETTLE_MONTHS = AniListClient.TOP_RATED_SETTLE_MONTHS;
  private static final int ANIME_TOP_RATED_PAGE_COUNT = 8;
  private static final Set<String> ANIME_TOP_RATED_FORMATS =
      Set.copyOf(AniListClient.ANIME_TOP_RATED_FORMATS);
  private static final int NEW_RELEASE_WINDOW_DAYS = AniListClient.NEW_RELEASE_WINDOW_DAYS;

  private static final Duration WIDE_PAGE_PACING = Duration.ofSeconds(3);

  private final AniListClient aniListClient;
  private final ProviderCache providerCache;
  private final Duration widePacing;

  @Autowired
  public AniListService(AniListClient aniListClient, ProviderCache providerCache) {
    this(aniListClient, providerCache, WIDE_PAGE_PACING);
  }

  AniListService(AniListClient aniListClient, ProviderCache providerCache, Duration widePacing) {
    this.aniListClient = aniListClient;
    this.providerCache = providerCache;
    this.widePacing = widePacing;
  }

  public List<AnimeSummaryResponseDto> getTrendingAnimeWide() {
    return trendingWide(ANIME_TYPE, null).stream().map(AniListMapper::toAnimeSummary).toList();
  }

  public List<MangaSummaryResponseDto> getTrendingMangaWide() {
    return trendingWide(MANGA_TYPE, MANGA_COUNTRY_OF_ORIGIN).stream()
        .map(AniListMapper::toMangaSummary)
        .toList();
  }

  public List<MangaSummaryResponseDto> getTrendingWebtoonsWide() {
    return trendingWide(MANGA_TYPE, WEBTOON_COUNTRY_OF_ORIGIN).stream()
        .map(AniListMapper::toMangaSummary)
        .toList();
  }

  public List<AnimeSummaryResponseDto> getTopRatedAnimeWide() {
    return topRatedWide(
            ANIME_TYPE, null, ANIME_TOP_RATED_MIN_POPULARITY, ANIME_TOP_RATED_PAGE_COUNT)
        .stream()
        .filter(media -> ANIME_TOP_RATED_FORMATS.contains(media.format()))
        .filter(media -> media.relations() == null || !media.relations().hasPrequel())
        .map(AniListMapper::toAnimeSummary)
        .toList();
  }

  public List<MangaSummaryResponseDto> getTopRatedMangaWide() {
    return topRatedWide(
            MANGA_TYPE, MANGA_COUNTRY_OF_ORIGIN, MANGA_TOP_RATED_MIN_POPULARITY, WIDE_PAGE_COUNT)
        .stream()
        .map(AniListMapper::toMangaSummary)
        .toList();
  }

  public List<MangaSummaryResponseDto> getTopRatedWebtoonsWide() {
    return topRatedWide(
            MANGA_TYPE,
            WEBTOON_COUNTRY_OF_ORIGIN,
            WEBTOON_TOP_RATED_MIN_POPULARITY,
            WIDE_PAGE_COUNT)
        .stream()
        .map(AniListMapper::toMangaSummary)
        .toList();
  }

  public List<AnimeSummaryResponseDto> getUpcomingAnimeWide() {
    LocalDate today = LocalDate.now();
    int startedAfter = toFuzzyDate(today);
    int startedBefore = toFuzzyDate(today.plusDays(AniListClient.UPCOMING_WINDOW_DAYS));
    return wide(
            WIDE_PAGE_COUNT,
            page ->
                aniListClient.fetchNew(
                    ANIME_TYPE, page, WIDE_PER_PAGE, null, startedAfter, startedBefore))
        .stream()
        .filter(AniListService::hasExactStartDate)
        .map(AniListMapper::toAnimeSummary)
        .toList();
  }

  private static boolean hasExactStartDate(AniListMediaResponseDto media) {
    return media.startDate() != null && media.startDate().day() != null;
  }

  public List<AnimeSummaryResponseDto> getNewAnimeWide() {
    return newWide(ANIME_TYPE, null).stream().map(AniListMapper::toAnimeSummary).toList();
  }

  public List<MangaSummaryResponseDto> getNewMangaWide() {
    return newWide(MANGA_TYPE, MANGA_COUNTRY_OF_ORIGIN).stream()
        .map(AniListMapper::toMangaSummary)
        .toList();
  }

  public List<MangaSummaryResponseDto> getNewWebtoonsWide() {
    return newWide(MANGA_TYPE, WEBTOON_COUNTRY_OF_ORIGIN).stream()
        .map(AniListMapper::toMangaSummary)
        .toList();
  }

  private List<AniListMediaResponseDto> trendingWide(String type, String countryOfOrigin) {
    return wide(
        WIDE_PAGE_COUNT,
        page -> aniListClient.fetchTrending(type, page, WIDE_PER_PAGE, countryOfOrigin));
  }

  private List<AniListMediaResponseDto> topRatedWide(
      String type, String countryOfOrigin, int minPopularity, int pageCount) {
    int startedBefore = toFuzzyDate(LocalDate.now().minusMonths(TOP_RATED_SETTLE_MONTHS));
    return wide(
        pageCount,
        page ->
            aniListClient.fetchTopRated(
                type, page, WIDE_PER_PAGE, countryOfOrigin, minPopularity, startedBefore));
  }

  private List<AniListMediaResponseDto> newWide(String type, String countryOfOrigin) {
    LocalDate today = LocalDate.now();
    int startedAfter = toFuzzyDate(today.minusDays(NEW_RELEASE_WINDOW_DAYS));
    int startedBefore = toFuzzyDate(today);
    return wide(
        WIDE_PAGE_COUNT,
        page ->
            aniListClient.fetchNew(
                type, page, WIDE_PER_PAGE, countryOfOrigin, startedAfter, startedBefore));
  }

  private static int toFuzzyDate(LocalDate date) {
    return date.getYear() * 10_000 + date.getMonthValue() * 100 + date.getDayOfMonth();
  }

  private List<AniListMediaResponseDto> wide(
      int pageCount, IntFunction<List<AniListMediaResponseDto>> fetchPage) {
    List<AniListMediaResponseDto> media = new ArrayList<>(pageCount * WIDE_PER_PAGE);
    for (int page = 1; page <= pageCount; page++) {
      pause(widePacing);
      media.addAll(fetchPage.apply(page));
    }
    return media;
  }

  private static void pause(Duration duration) {
    if (duration.isZero()) {
      return;
    }
    try {
      Thread.sleep(duration);
    } catch (InterruptedException ex) {
      Thread.currentThread().interrupt();
    }
  }

  public List<AnimeSummaryResponseDto> searchAnime(String query, int page) {
    return aniListClient.search(ANIME_TYPE, query, TRENDING_PER_PAGE, null, page).stream()
        .map(AniListMapper::toAnimeSummary)
        .toList();
  }

  public List<MangaSummaryResponseDto> searchManga(String query, int page) {
    return aniListClient
        .search(MANGA_TYPE, query, TRENDING_PER_PAGE, MANGA_COUNTRY_OF_ORIGIN, page)
        .stream()
        .map(AniListMapper::toMangaSummary)
        .toList();
  }

  public List<MangaSummaryResponseDto> searchWebtoons(String query, int page) {
    return aniListClient
        .search(MANGA_TYPE, query, TRENDING_PER_PAGE, WEBTOON_COUNTRY_OF_ORIGIN, page)
        .stream()
        .map(AniListMapper::toMangaSummary)
        .toList();
  }

  public AniListSearchResultsDto searchEveryFormat(String query, int page) {
    AniListSearchEveryFormatResponseDto.Data data =
        aniListClient.searchEveryFormat(query, TRENDING_PER_PAGE, page);
    return new AniListSearchResultsDto(
        media(data.anime()).stream().map(AniListMapper::toAnimeSummary).toList(),
        media(data.manga()).stream().map(AniListMapper::toMangaSummary).toList(),
        media(data.webtoon()).stream().map(AniListMapper::toMangaSummary).toList());
  }

  private static List<AniListMediaResponseDto> media(AniListPageResponseDto page) {
    return page == null || page.media() == null ? List.of() : page.media();
  }

  public NextAiringDto getNextAiring(long id) {
    return providerCache.get(
        ProviderCacheSpace.ANILIST_ANIME_NEXT,
        String.valueOf(id),
        NextAiringDto.class,
        () -> AniListMapper.toNextAiring(aniListClient.fetchById(id, ANIME_TYPE)));
  }

  public AnimeDetailResponseDto getAnime(long id) {
    return providerCache.get(
        ProviderCacheSpace.ANILIST_ANIME,
        String.valueOf(id),
        AnimeDetailResponseDto.class,
        () -> AniListMapper.toAnimeDetail(aniListClient.fetchById(id, ANIME_TYPE)));
  }

  public MangaDetailResponseDto getManga(long id) {
    return providerCache.get(
        ProviderCacheSpace.ANILIST_MANGA,
        String.valueOf(id),
        MangaDetailResponseDto.class,
        () -> AniListMapper.toMangaDetail(aniListClient.fetchById(id, MANGA_TYPE)));
  }

  public PersonDetailResponseDto getStaff(long id) {
    var response = aniListClient.fetchStaffById(id, 1);
    if (response == null || response.data() == null || response.data().Staff() == null) {
      throw new ResourceNotFoundException(
          ErrorCode.ANILIST_RESOURCE_NOT_FOUND, "AniList staff not found");
    }
    AniListStaffDetailResponseDto staff = response.data().Staff();
    List<AniListMediaEdgeResponseDto> edges = new ArrayList<>(edges(staff.staffMedia()));
    AniListMediaConnectionResponseDto connection = staff.staffMedia();
    for (int page = 2;
        page <= STAFF_MAX_CREDIT_PAGES
            && hasNextPage(connection)
            && distinctWorks(edges) < STAFF_TARGET_WORKS;
        page++) {
      var next = aniListClient.fetchStaffById(id, page);
      if (next == null || next.data() == null || next.data().Staff() == null) {
        break;
      }
      connection = next.data().Staff().staffMedia();
      edges.addAll(edges(connection));
    }
    return AniListMapper.toStaffDetail(
        new AniListStaffDetailResponseDto(
            staff.id(),
            staff.name(),
            staff.description(),
            staff.image(),
            new AniListMediaConnectionResponseDto(edges, null)));
  }

  private static List<AniListMediaEdgeResponseDto> edges(
      AniListMediaConnectionResponseDto connection) {
    return connection == null || connection.edges() == null ? List.of() : connection.edges();
  }

  private static boolean hasNextPage(AniListMediaConnectionResponseDto connection) {
    return connection != null
        && connection.pageInfo() != null
        && connection.pageInfo().hasNextPage();
  }

  private static long distinctWorks(List<AniListMediaEdgeResponseDto> edges) {
    return edges.stream()
        .map(AniListMediaEdgeResponseDto::node)
        .filter(Objects::nonNull)
        .map(node -> node.id())
        .distinct()
        .count();
  }

  public PersonDetailResponseDto getCharacter(long id) {
    var response = aniListClient.fetchCharacterById(id);
    if (response == null || response.data() == null || response.data().Character() == null) {
      throw new ResourceNotFoundException(
          ErrorCode.ANILIST_RESOURCE_NOT_FOUND, "AniList character not found");
    }
    return AniListMapper.toCharacterDetail(response.data().Character());
  }

  public StudioDetailResponseDto getStudio(long id) {
    var response = aniListClient.fetchStudioById(id);
    if (response == null || response.data() == null || response.data().Studio() == null) {
      throw new ResourceNotFoundException(
          ErrorCode.ANILIST_RESOURCE_NOT_FOUND, "AniList studio not found");
    }
    return AniListMapper.toStudioDetail(response.data().Studio());
  }

  public BrowseMediaResponseDto browseMedia(
      String mediaType, String genre, String tag, int page, String countryOfOrigin) {
    int perPage = 24;
    String type =
        switch (mediaType) {
          case "anime" -> ANIME_TYPE;
          case "manga", "webtoon" -> MANGA_TYPE;
          default -> mediaType;
        };
    String effectiveCountryOfOrigin =
        countryOfOrigin != null
            ? countryOfOrigin
            : switch (mediaType) {
              case "manga" -> MANGA_COUNTRY_OF_ORIGIN;
              case "webtoon" -> WEBTOON_COUNTRY_OF_ORIGIN;
              default -> null;
            };
    var response =
        aniListClient.browseMedia(type, page, perPage, genre, tag, effectiveCountryOfOrigin);
    if (response == null || response.data() == null || response.data().Page() == null) {
      return new BrowseMediaResponseDto(List.of(), false);
    }
    var pageData = response.data().Page();
    var items =
        pageData.media() == null
            ? List.<AniListEntityMediaResponseDto>of()
            : pageData.media().stream()
                .map(AniListMapper::toEntityMedia)
                .filter(m -> m.title() != null)
                .toList();
    boolean hasNext =
        pageData.pageInfo() != null && Boolean.TRUE.equals(pageData.pageInfo().hasNextPage());
    return new BrowseMediaResponseDto(items, hasNext);
  }

  public MediaPageResponseDto<AnimeSummaryResponseDto> exploreAnime(AniListExploreQuery query) {
    AniListPageResponseDto page = aniListClient.explore(ANIME_TYPE, null, query);
    return new MediaPageResponseDto<>(
        page.media().stream().map(AniListMapper::toAnimeSummary).toList(), hasNext(page));
  }

  public MediaPageResponseDto<ExploredMangaDto> exploreManga(
      AniListExploreQuery query, MangaOrigin origin) {
    String country =
        switch (origin) {
          case JAPAN -> MANGA_COUNTRY_OF_ORIGIN;
          case KOREA -> WEBTOON_COUNTRY_OF_ORIGIN;
          case ANY -> null;
        };
    AniListPageResponseDto page = aniListClient.explore(MANGA_TYPE, country, query);
    List<ExploredMangaDto> items =
        page.media().stream()
            .map(
                media ->
                    new ExploredMangaDto(
                        AniListMapper.toMangaSummary(media),
                        WEBTOON_COUNTRY_OF_ORIGIN.equals(media.countryOfOrigin())))
            .toList();
    return new MediaPageResponseDto<>(items, hasNext(page));
  }

  @Cacheable(CacheConfig.ANILIST_GENRES)
  public List<String> getGenres() {
    return aniListClient.fetchCollections().GenreCollection().stream().sorted().toList();
  }

  @Cacheable(CacheConfig.ANILIST_TAGS)
  public List<String> getTags(boolean includeAdult) {
    return aniListClient.fetchCollections().MediaTagCollection().stream()
        .filter(tag -> includeAdult || !Boolean.TRUE.equals(tag.isAdult()))
        .map(AniListCollectionsResponseDto.Tag::name)
        .sorted()
        .toList();
  }

  private static boolean hasNext(AniListPageResponseDto page) {
    return page.pageInfo() != null && page.pageInfo().hasNextPage();
  }
}
