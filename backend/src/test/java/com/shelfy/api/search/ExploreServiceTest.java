package com.shelfy.api.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.shelfy.api.anilist.AniListService;
import com.shelfy.api.anilist.client.AniListExploreQuery;
import com.shelfy.api.auth.ViewerPreferences;
import com.shelfy.api.collection.MediaType;
import com.shelfy.api.common.cache.ProviderCache;
import com.shelfy.api.igdb.IgdbService;
import com.shelfy.api.igdb.client.IgdbExploreQuery;
import com.shelfy.api.igdb.dto.GameSummaryResponseDto;
import com.shelfy.api.igdb.dto.MediaPageResponseDto;
import com.shelfy.api.search.ExploreVocabulary.Catalog;
import com.shelfy.api.search.dto.ExploreResponseDto;
import com.shelfy.api.tmdb.TmdbService;
import com.shelfy.api.tmdb.client.TmdbDiscoverQuery;
import com.shelfy.api.tmdb.dto.MovieSummaryResponseDto;
import com.shelfy.api.tmdb.dto.TmdbSearchResponseDto;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ExploreServiceTest {

  private final TmdbService tmdb = mock(TmdbService.class);
  private final AniListService aniList = mock(AniListService.class);
  private final IgdbService igdb = mock(IgdbService.class);
  private final SearchService search = mock(SearchService.class);
  private final InCollectionMarker marker = mock(InCollectionMarker.class);
  private final ViewerPreferences preferences = mock(ViewerPreferences.class);
  private final ProviderCache cache = passThroughCache();
  private final ExploreService service =
      new ExploreService(
          tmdb,
          aniList,
          igdb,
          search,
          new SearchResultMapper(tmdb),
          new ExploreVocabulary(),
          marker,
          preferences,
          cache,
          Runnable::run);
  private final UUID userId = UUID.randomUUID();

  @BeforeEach
  void setUp() {
    when(marker.mark(any(), any())).thenAnswer(invocation -> invocation.getArgument(1));
    when(igdb.explore(any())).thenReturn(new MediaPageResponseDto<>(List.of(game(1)), true));
  }

  @Test
  void explore_skipsCatalogsThatCannotHonourEveryCriterion() {
    ExploreResponseDto response =
        service.explore(userId, request(null, List.of("open-world", "platform:167")));

    assertThat(response.results()).extracting("externalId").containsExactly("1");
    assertThat(response.skippedTypes())
        .containsExactlyInAnyOrder(
            MediaType.MOVIE,
            MediaType.TV_SHOW,
            MediaType.ANIME,
            MediaType.MANGA,
            MediaType.WEBTOON);
    verify(tmdb, never()).discoverMovies(any());
    verify(aniList, never()).exploreAnime(any());
  }

  @Test
  void explore_translatesSharedCriteriaForEachCatalog() {
    when(tmdb.findKeywordId("time travel")).thenReturn(Optional.of(4379));
    when(igdb.findKeywordId("time-travel")).thenReturn(Optional.of(77L));
    when(tmdb.discoverMovies(any())).thenReturn(movies(0));

    service.explore(userId, request(MediaType.MOVIE, List.of("science-fiction", "time-travel")));
    service.explore(userId, request(MediaType.GAME, List.of("science-fiction", "time-travel")));

    ArgumentCaptor<TmdbDiscoverQuery> tmdbQuery = ArgumentCaptor.forClass(TmdbDiscoverQuery.class);
    verify(tmdb).discoverMovies(tmdbQuery.capture());
    assertThat(tmdbQuery.getValue().genres()).containsExactly(878);
    assertThat(tmdbQuery.getValue().keywords()).containsExactly(4379);
    ArgumentCaptor<IgdbExploreQuery> igdbQuery = ArgumentCaptor.forClass(IgdbExploreQuery.class);
    verify(igdb).explore(igdbQuery.capture());
    assertThat(igdbQuery.getValue().themes()).containsExactly(18L);
    assertThat(igdbQuery.getValue().keywords()).containsExactly(77L);
    assertThat(igdbQuery.getValue().limit()).isEqualTo(24);
  }

  @Test
  void explore_splitsTmdbPagesInHalfWhenMixingCatalogs() {
    when(tmdb.discoverMovies(any())).thenReturn(movies(20));
    when(tmdb.discoverTvShows(any())).thenReturn(new TmdbSearchResponseDto<>(List.of(), 1, 1, 0));
    when(aniList.exploreAnime(any())).thenReturn(new MediaPageResponseDto<>(List.of(), false));
    when(aniList.exploreManga(any(), any()))
        .thenReturn(new MediaPageResponseDto<>(List.of(), false));

    ExploreResponseDto first = service.explore(userId, page(1));
    ExploreResponseDto second = service.explore(userId, page(2));

    assertThat(first.results()).filteredOn(r -> r.mediaType() == MediaType.MOVIE).hasSize(10);
    assertThat(second.results())
        .filteredOn(r -> r.mediaType() == MediaType.MOVIE)
        .extracting("externalId")
        .contains("11", "20")
        .doesNotContain("1");
    ArgumentCaptor<AniListExploreQuery> aniListQuery =
        ArgumentCaptor.forClass(AniListExploreQuery.class);
    verify(aniList, times(2)).exploreAnime(aniListQuery.capture());
    assertThat(aniListQuery.getValue().perPage()).isEqualTo(10);
  }

  @Test
  void explore_rejectsUnknownSharedCriteria() {
    assertThrows(
        IllegalArgumentException.class,
        () -> service.explore(userId, request(null, List.of("not-a-criterion"))));
  }

  private static ExploreRequest request(MediaType type, List<String> with) {
    return new ExploreRequest(
        type,
        "",
        with.stream().map(ExploreCriterion::parse).toList(),
        List.of(),
        null,
        null,
        ExploreSort.POPULAR,
        1,
        "FR");
  }

  @Test
  void cacheKey_ignoresCriteriaOrderAndQueryCasing() {
    ExploreRequest first =
        new ExploreRequest(
            MediaType.MOVIE,
            "  Space  Opera",
            List.of(
                ExploreCriterion.parse("tmdb-genre:878"), ExploreCriterion.parse("tmdb-genre:12")),
            List.of(),
            2000,
            null,
            ExploreSort.POPULAR,
            1,
            "FR");
    ExploreRequest second =
        new ExploreRequest(
            MediaType.MOVIE,
            "space opera",
            List.of(
                ExploreCriterion.parse("tmdb-genre:12"), ExploreCriterion.parse("tmdb-genre:878")),
            List.of(),
            2000,
            null,
            ExploreSort.POPULAR,
            1,
            "FR");

    assertThat(ExploreService.cacheKey(Catalog.TMDB_MOVIE, first, false))
        .isEqualTo(ExploreService.cacheKey(Catalog.TMDB_MOVIE, second, false))
        .isNotEqualTo(ExploreService.cacheKey(Catalog.TMDB_MOVIE, second, true));
  }

  private static ProviderCache passThroughCache() {
    ProviderCache cache = mock(ProviderCache.class);
    when(cache.get(any(), anyString(), any(), any()))
        .thenAnswer(invocation -> invocation.<Supplier<?>>getArgument(3).get());
    return cache;
  }

  private static ExploreRequest page(int page) {
    return new ExploreRequest(
        null, "", List.of(), List.of(), null, null, ExploreSort.POPULAR, page, "FR");
  }

  private static TmdbSearchResponseDto<MovieSummaryResponseDto> movies(int count) {
    List<MovieSummaryResponseDto> movies =
        IntStream.rangeClosed(1, count)
            .mapToObj(
                id ->
                    new MovieSummaryResponseDto(
                        id,
                        "Movie " + id,
                        "Movie " + id,
                        "",
                        null,
                        null,
                        LocalDate.of(2010, 1, 1),
                        List.of(),
                        7.5,
                        1_000 - id,
                        false))
            .toList();
    return new TmdbSearchResponseDto<>(movies, 1, 5, 100);
  }

  private static GameSummaryResponseDto game(long id) {
    return new GameSummaryResponseDto(
        id,
        "Game " + id,
        "",
        LocalDate.of(2020, 1, 1),
        null,
        List.of(),
        List.of(),
        List.of(),
        List.of(),
        8.0,
        100,
        false);
  }
}
