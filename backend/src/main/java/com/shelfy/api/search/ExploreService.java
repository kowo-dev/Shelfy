package com.shelfy.api.search;

import com.shelfy.api.anilist.AniListService;
import com.shelfy.api.anilist.client.AniListExploreQuery;
import com.shelfy.api.anilist.dto.MangaOrigin;
import com.shelfy.api.auth.ViewerPreferences;
import com.shelfy.api.collection.MediaType;
import com.shelfy.api.common.cache.ProviderCache;
import com.shelfy.api.common.cache.ProviderCacheSpace;
import com.shelfy.api.common.http.ProviderRateLimiter;
import com.shelfy.api.igdb.IgdbService;
import com.shelfy.api.igdb.client.IgdbExploreQuery;
import com.shelfy.api.search.ExploreCriterion.Kind;
import com.shelfy.api.search.ExploreVocabulary.Catalog;
import com.shelfy.api.search.ExploreVocabulary.Ref;
import com.shelfy.api.search.dto.ExploreResponseDto;
import com.shelfy.api.search.dto.SearchResponseDto;
import com.shelfy.api.search.dto.SearchResultResponseDto;
import com.shelfy.api.tmdb.TmdbService;
import com.shelfy.api.tmdb.client.TmdbDiscoverQuery;
import com.shelfy.api.tmdb.dto.TmdbGenreDto;
import com.shelfy.api.tmdb.dto.TmdbSearchResponseDto;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

@Service
public class ExploreService {

  private static final Logger LOG = LoggerFactory.getLogger(ExploreService.class);
  private static final long CATALOG_TIMEOUT_SECONDS = 6;
  private static final int SINGLE_PAGE_SIZE = 24;
  private static final int MIXED_PAGE_SIZE = 10;
  private static final Duration PROVIDER_RATE_WAIT = Duration.ofSeconds(1);

  private final TmdbService tmdbService;
  private final AniListService aniListService;
  private final IgdbService igdbService;
  private final SearchService searchService;
  private final SearchResultMapper mapper;
  private final ExploreVocabulary vocabulary;
  private final InCollectionMarker inCollectionMarker;
  private final ViewerPreferences viewerPreferences;
  private final ProviderCache providerCache;
  private final Executor searchExecutor;

  public ExploreService(
      TmdbService tmdbService,
      AniListService aniListService,
      IgdbService igdbService,
      SearchService searchService,
      SearchResultMapper mapper,
      ExploreVocabulary vocabulary,
      InCollectionMarker inCollectionMarker,
      ViewerPreferences viewerPreferences,
      ProviderCache providerCache,
      @Qualifier("searchExecutor") Executor searchExecutor) {
    this.tmdbService = tmdbService;
    this.aniListService = aniListService;
    this.igdbService = igdbService;
    this.searchService = searchService;
    this.mapper = mapper;
    this.vocabulary = vocabulary;
    this.inCollectionMarker = inCollectionMarker;
    this.viewerPreferences = viewerPreferences;
    this.providerCache = providerCache;
    this.searchExecutor = searchExecutor;
  }

  public ExploreResponseDto explore(UUID userId, ExploreRequest request) {
    request.with().stream()
        .filter(criterion -> criterion.kind() == Kind.SHARED)
        .forEach(criterion -> requireEntry(criterion.value()));
    if (request.isPlainSearch()) {
      SearchResponseDto search =
          searchService.search(userId, request.query(), request.page(), request.type());
      return new ExploreResponseDto(
          search.results(),
          search.page(),
          search.hasMore(),
          search.unavailableProviders(),
          List.of());
    }
    boolean includeAdult = viewerPreferences.allowsAdultContent(userId);
    boolean mixed = request.type() == null;
    List<MediaType> skippedTypes = new ArrayList<>();
    List<CompletableFuture<CatalogPage>> calls = new ArrayList<>();
    for (Catalog catalog : catalogs(request.type())) {
      Optional<Filters> filters = filters(catalog, request);
      if (filters.isEmpty()) {
        skippedTypes.addAll(mixed ? catalog.mediaTypes() : List.of(request.type()));
        continue;
      }
      calls.add(
          async(
              catalog,
              cacheKey(catalog, request, includeAdult),
              () -> explore(catalog, request, filters.get(), includeAdult, mixed)));
    }
    List<CatalogPage> pages = calls.stream().map(CompletableFuture::join).toList();
    List<SearchResultResponseDto> results =
        sort(pages.stream().flatMap(page -> page.results().stream()).toList(), request);
    for (CatalogPage page : pages) {
      if (page.isUnsupported()) {
        skippedTypes.addAll(mixed ? page.catalog().mediaTypes() : List.of(request.type()));
      }
    }
    List<String> unavailable =
        pages.stream()
            .filter(CatalogPage::isUnavailable)
            .map(page -> provider(page.catalog()))
            .distinct()
            .toList();
    return new ExploreResponseDto(
        inCollectionMarker.mark(userId, results),
        request.page(),
        pages.stream().anyMatch(CatalogPage::hasMore),
        unavailable,
        skippedTypes.stream().distinct().toList());
  }

  static String cacheKey(Catalog catalog, ExploreRequest request, boolean includeAdult) {
    return String.join(
        "|",
        "v2",
        catalog.name(),
        includeAdult ? "adult" : "safe",
        String.valueOf(request.type()),
        SearchService.normalize(request.query()),
        criteria(request.with()),
        criteria(request.without()),
        String.valueOf(request.fromYear()),
        String.valueOf(request.toYear()),
        request.sort().name(),
        String.valueOf(request.page()),
        request.region());
  }

  private static String criteria(List<ExploreCriterion> criteria) {
    return criteria.stream()
        .map(criterion -> criterion.kind() + "=" + criterion.value())
        .sorted()
        .collect(Collectors.joining(","));
  }

  private ExploreVocabulary.Entry requireEntry(String id) {
    return vocabulary.find(id).orElseThrow(() -> new IllegalArgumentException("Unknown criterion"));
  }

  private static List<Catalog> catalogs(MediaType type) {
    if (type == null) {
      return List.of(Catalog.values());
    }
    return switch (type) {
      case MOVIE -> List.of(Catalog.TMDB_MOVIE);
      case TV_SHOW -> List.of(Catalog.TMDB_TV);
      case ANIME -> List.of(Catalog.ANILIST_ANIME);
      case MANGA, WEBTOON -> List.of(Catalog.ANILIST_MANGA);
      case GAME -> List.of(Catalog.IGDB);
      case BOOK -> throw new IllegalArgumentException("Books cannot be explored");
    };
  }

  private Optional<Filters> filters(Catalog catalog, ExploreRequest request) {
    List<Ref> include = new ArrayList<>();
    for (ExploreCriterion criterion : request.with()) {
      Optional<Ref> ref = ref(catalog, criterion);
      if (ref.isEmpty()) {
        return Optional.empty();
      }
      include.add(ref.get());
    }
    List<Ref> exclude =
        request.without().stream()
            .map(criterion -> ref(catalog, criterion))
            .flatMap(Optional::stream)
            .toList();
    return Optional.of(new Filters(include, exclude));
  }

  private Optional<Ref> ref(Catalog catalog, ExploreCriterion criterion) {
    boolean supported =
        switch (criterion.kind()) {
          case SHARED -> true;
          case TMDB_GENRE, TMDB_KEYWORD, STREAMING -> catalog.isTmdb();
          case ANILIST_GENRE, ANILIST_TAG -> catalog.isAniList();
          case IGDB_GENRE, IGDB_THEME, IGDB_KEYWORD, PLATFORM -> catalog == Catalog.IGDB;
        };
    if (!supported) {
      return Optional.empty();
    }
    if (criterion.kind() == Kind.SHARED) {
      return Optional.ofNullable(requireEntry(criterion.value()).refs().get(catalog));
    }
    return Optional.of(new Ref(criterion.kind(), criterion.value()));
  }

  private CatalogPage explore(
      Catalog catalog,
      ExploreRequest request,
      Filters filters,
      boolean includeAdult,
      boolean mixed) {
    return switch (catalog) {
      case TMDB_MOVIE, TMDB_TV -> exploreTmdb(catalog, request, filters, includeAdult, mixed);
      case ANILIST_ANIME, ANILIST_MANGA ->
          exploreAniList(catalog, request, filters, includeAdult, mixed);
      case IGDB -> exploreIgdb(request, filters, includeAdult, mixed);
    };
  }

  private CatalogPage exploreTmdb(
      Catalog catalog,
      ExploreRequest request,
      Filters filters,
      boolean includeAdult,
      boolean mixed) {
    List<Integer> genres = ids(filters.include(), Kind.TMDB_GENRE);
    List<Integer> withoutGenres = ids(filters.exclude(), Kind.TMDB_GENRE);
    List<Integer> streaming = ids(filters.include(), Kind.STREAMING);
    Optional<List<Integer>> keywords = tmdbKeywords(filters.include());
    if (keywords.isEmpty()) {
      return CatalogPage.unsupported(catalog);
    }
    List<Integer> withoutKeywords = tmdbKeywords(filters.exclude()).orElse(List.of());
    int tmdbPage = mixed ? (request.page() + 1) / 2 : request.page();
    boolean movies = catalog == Catalog.TMDB_MOVIE;
    if (request.hasQuery()) {
      if (!keywords.get().isEmpty() || !streaming.isEmpty()) {
        return CatalogPage.unsupported(catalog);
      }
      TmdbSearchResponseDto<SearchResultResponseDto> found =
          movies
              ? mapPage(
                  tmdbService.searchMovies(request.query(), tmdbPage, includeAdult),
                  mapper::toResult)
              : mapPage(
                  tmdbService.searchTvShows(request.query(), tmdbPage, includeAdult),
                  mapper::toResult);
      return halve(
          catalog,
          found.results().stream()
              .filter(result -> matchesYears(result, request))
              .filter(result -> matchesGenres(result, catalog, genres, withoutGenres))
              .toList(),
          tmdbPage < found.totalPages(),
          request.page(),
          mixed);
    }
    TmdbDiscoverQuery query =
        new TmdbDiscoverQuery(
            genres,
            withoutGenres,
            keywords.get(),
            withoutKeywords,
            streaming,
            request.region(),
            request.fromYear() == null ? null : LocalDate.of(request.fromYear(), 1, 1),
            request.toYear() == null ? null : LocalDate.of(request.toYear(), 12, 31),
            TmdbDiscoverQuery.Sort.valueOf(request.sort().name()),
            tmdbPage,
            includeAdult);
    TmdbSearchResponseDto<SearchResultResponseDto> found =
        movies
            ? mapPage(tmdbService.discoverMovies(query), mapper::toResult)
            : mapPage(tmdbService.discoverTvShows(query), mapper::toResult);
    return halve(catalog, found.results(), tmdbPage < found.totalPages(), request.page(), mixed);
  }

  private CatalogPage exploreAniList(
      Catalog catalog,
      ExploreRequest request,
      Filters filters,
      boolean includeAdult,
      boolean mixed) {
    int perPage = mixed ? MIXED_PAGE_SIZE : SINGLE_PAGE_SIZE;
    AniListExploreQuery query =
        new AniListExploreQuery(
            request.query(),
            values(filters.include(), Kind.ANILIST_GENRE),
            values(filters.exclude(), Kind.ANILIST_GENRE),
            values(filters.include(), Kind.ANILIST_TAG),
            values(filters.exclude(), Kind.ANILIST_TAG),
            request.fromYear() == null ? null : (request.fromYear() - 1) * 10_000 + 1231,
            request.toYear() == null ? null : (request.toYear() + 1) * 10_000,
            AniListExploreQuery.Sort.valueOf(request.sort().name()),
            request.page(),
            perPage,
            includeAdult);
    if (catalog == Catalog.ANILIST_ANIME) {
      var page = aniListService.exploreAnime(query);
      return new CatalogPage(
          catalog,
          page.content().stream().map(mapper::toResult).toList(),
          page.hasMore(),
          false,
          false);
    }
    MangaOrigin origin =
        request.type() == MediaType.MANGA
            ? MangaOrigin.JAPAN
            : request.type() == MediaType.WEBTOON ? MangaOrigin.KOREA : MangaOrigin.ANY;
    var page = aniListService.exploreManga(query, origin);
    return new CatalogPage(
        catalog,
        page.content().stream()
            .map(
                item ->
                    mapper.toResult(
                        item.manga(), item.isWebtoon() ? MediaType.WEBTOON : MediaType.MANGA))
            .toList(),
        page.hasMore(),
        false,
        false);
  }

  private CatalogPage exploreIgdb(
      ExploreRequest request, Filters filters, boolean includeAdult, boolean mixed) {
    Optional<List<Long>> keywords = igdbKeywords(filters.include());
    if (keywords.isEmpty()) {
      return CatalogPage.unsupported(Catalog.IGDB);
    }
    int limit = mixed ? MIXED_PAGE_SIZE : SINGLE_PAGE_SIZE;
    IgdbExploreQuery query =
        new IgdbExploreQuery(
            request.query(),
            longIds(filters.include(), Kind.IGDB_GENRE),
            longIds(filters.include(), Kind.IGDB_THEME),
            keywords.get(),
            longIds(filters.include(), Kind.PLATFORM),
            longIds(filters.exclude(), Kind.IGDB_GENRE),
            longIds(filters.exclude(), Kind.IGDB_THEME),
            igdbKeywords(filters.exclude()).orElse(List.of()),
            request.fromYear() == null ? null : epochSecond(LocalDate.of(request.fromYear(), 1, 1)),
            request.toYear() == null ? null : epochSecond(LocalDate.of(request.toYear() + 1, 1, 1)),
            IgdbExploreQuery.Sort.valueOf(request.sort().name()),
            limit,
            (request.page() - 1) * limit,
            includeAdult);
    var page = igdbService.explore(query);
    return new CatalogPage(
        Catalog.IGDB,
        page.content().stream().map(mapper::toResult).toList(),
        page.hasMore(),
        false,
        false);
  }

  private Optional<List<Integer>> tmdbKeywords(List<Ref> refs) {
    List<Integer> ids = new ArrayList<>();
    for (Ref ref : refs) {
      if (ref.kind() != Kind.TMDB_KEYWORD) {
        continue;
      }
      Optional<Integer> id =
          isNumeric(ref.value())
              ? Optional.of(Integer.valueOf(ref.value()))
              : tmdbService.findKeywordId(ref.value());
      if (id.isEmpty()) {
        return Optional.empty();
      }
      ids.add(id.get());
    }
    return Optional.of(ids);
  }

  private Optional<List<Long>> igdbKeywords(List<Ref> refs) {
    List<Long> ids = new ArrayList<>();
    for (Ref ref : refs) {
      if (ref.kind() != Kind.IGDB_KEYWORD) {
        continue;
      }
      Optional<Long> id =
          isNumeric(ref.value())
              ? Optional.of(Long.valueOf(ref.value()))
              : igdbService.findKeywordId(ref.value());
      if (id.isEmpty()) {
        return Optional.empty();
      }
      ids.add(id.get());
    }
    return Optional.of(ids);
  }

  private static CatalogPage halve(
      Catalog catalog,
      List<SearchResultResponseDto> results,
      boolean morePages,
      int page,
      boolean mixed) {
    if (!mixed) {
      return new CatalogPage(catalog, results, morePages, false, false);
    }
    int split = Math.min(MIXED_PAGE_SIZE, results.size());
    boolean firstHalf = page % 2 == 1;
    List<SearchResultResponseDto> half =
        firstHalf ? results.subList(0, split) : results.subList(split, results.size());
    boolean hasMore = morePages || (firstHalf && results.size() > split);
    return new CatalogPage(catalog, half, hasMore, false, false);
  }

  private static boolean matchesYears(SearchResultResponseDto result, ExploreRequest request) {
    if (request.fromYear() == null && request.toYear() == null) {
      return true;
    }
    Integer year = result.releaseYear();
    return year != null
        && (request.fromYear() == null || year >= request.fromYear())
        && (request.toYear() == null || year <= request.toYear());
  }

  private boolean matchesGenres(
      SearchResultResponseDto result,
      Catalog catalog,
      List<Integer> genres,
      List<Integer> withoutGenres) {
    if (genres.isEmpty() && withoutGenres.isEmpty()) {
      return true;
    }
    Map<Integer, String> names =
        (catalog == Catalog.TMDB_MOVIE ? tmdbService.getMovieGenres() : tmdbService.getTvGenres())
            .stream().collect(Collectors.toMap(TmdbGenreDto::id, TmdbGenreDto::name));
    return genres.stream().allMatch(id -> result.genres().contains(names.get(id)))
        && withoutGenres.stream().noneMatch(id -> result.genres().contains(names.get(id)));
  }

  private static List<SearchResultResponseDto> sort(
      List<SearchResultResponseDto> results, ExploreRequest request) {
    if (request.hasQuery() || request.sort() == ExploreSort.POPULAR) {
      return SearchRanking.sortByPopularity(results);
    }
    Comparator<SearchResultResponseDto> order =
        request.sort() == ExploreSort.RATING
            ? Comparator.comparing(
                SearchResultResponseDto::voteAverage,
                Comparator.nullsFirst(Comparator.naturalOrder()))
            : Comparator.comparing(
                SearchResultResponseDto::releaseYear,
                Comparator.nullsFirst(Comparator.naturalOrder()));
    return results.stream().sorted(order.reversed()).toList();
  }

  private CompletableFuture<CatalogPage> async(
      Catalog catalog, String key, Supplier<CatalogPage> call) {
    return CompletableFuture.supplyAsync(
            () ->
                ScopedValue.where(ProviderRateLimiter.MAX_WAIT, PROVIDER_RATE_WAIT)
                    .call(
                        () ->
                            providerCache.get(
                                ProviderCacheSpace.EXPLORE, key, CatalogPage.class, call)),
            searchExecutor)
        .exceptionally(
            ex -> {
              LOG.warn("{} exploration failed; returning partial results", catalog, ex);
              return CatalogPage.unavailable(catalog);
            })
        .completeOnTimeout(
            CatalogPage.unavailable(catalog), CATALOG_TIMEOUT_SECONDS, TimeUnit.SECONDS);
  }

  private static <T> TmdbSearchResponseDto<SearchResultResponseDto> mapPage(
      TmdbSearchResponseDto<T> page, Function<T, SearchResultResponseDto> map) {
    return new TmdbSearchResponseDto<>(
        page.results().stream().map(map).toList(),
        page.page(),
        page.totalPages(),
        page.totalResults());
  }

  private static List<Integer> ids(List<Ref> refs, Kind kind) {
    return values(refs, kind).stream().map(Integer::valueOf).toList();
  }

  private static List<Long> longIds(List<Ref> refs, Kind kind) {
    return values(refs, kind).stream().map(Long::valueOf).toList();
  }

  private static List<String> values(List<Ref> refs, Kind kind) {
    return refs.stream().filter(ref -> ref.kind() == kind).map(Ref::value).distinct().toList();
  }

  private static boolean isNumeric(String value) {
    return !value.isEmpty() && value.chars().allMatch(Character::isDigit);
  }

  private static long epochSecond(LocalDate date) {
    return date.atStartOfDay(ZoneOffset.UTC).toEpochSecond();
  }

  private static String provider(Catalog catalog) {
    return switch (catalog) {
      case TMDB_MOVIE, TMDB_TV -> SearchResultMapper.TMDB_PROVIDER;
      case ANILIST_ANIME, ANILIST_MANGA -> SearchResultMapper.ANILIST_PROVIDER;
      case IGDB -> SearchResultMapper.IGDB_PROVIDER;
    };
  }

  private record Filters(List<Ref> include, List<Ref> exclude) {}

  record CatalogPage(
      Catalog catalog,
      List<SearchResultResponseDto> results,
      boolean hasMore,
      boolean isUnavailable,
      boolean isUnsupported) {

    static CatalogPage unavailable(Catalog catalog) {
      return new CatalogPage(catalog, List.of(), false, true, false);
    }

    static CatalogPage unsupported(Catalog catalog) {
      return new CatalogPage(catalog, List.of(), false, false, true);
    }
  }
}
