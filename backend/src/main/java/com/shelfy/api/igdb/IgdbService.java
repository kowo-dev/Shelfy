package com.shelfy.api.igdb;

import com.shelfy.api.common.cache.ProviderCache;
import com.shelfy.api.common.cache.ProviderCacheSpace;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.config.CacheConfig;
import com.shelfy.api.igdb.client.IgdbClient;
import com.shelfy.api.igdb.client.IgdbExploreQuery;
import com.shelfy.api.igdb.client.IgdbFacetResponseDto;
import com.shelfy.api.igdb.client.IgdbGameResponseDto;
import com.shelfy.api.igdb.dto.CompanyDetailResponseDto;
import com.shelfy.api.igdb.dto.FranchiseDetailResponseDto;
import com.shelfy.api.igdb.dto.GameDetailResponseDto;
import com.shelfy.api.igdb.dto.GameSummaryResponseDto;
import com.shelfy.api.igdb.dto.IgdbFacetDto;
import com.shelfy.api.igdb.dto.IgdbFacetKind;
import com.shelfy.api.igdb.dto.MediaPageResponseDto;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class IgdbService {

  private static final int PAGE_SIZE = 50;

  private final IgdbClient igdbClient;
  private final ProviderCache providerCache;

  private static final int WIDE_LIMIT = 150;
  private static final int UPCOMING_LIMIT = 60;
  private static final int UPCOMING_WINDOW_DAYS = IgdbClient.UPCOMING_WINDOW_DAYS;
  private static final int TOP_RATED_MIN_RATINGS = IgdbClient.TOP_RATED_MIN_RATINGS;
  private static final int NEW_RELEASE_WINDOW_DAYS = IgdbClient.NEW_RELEASE_WINDOW_DAYS;

  public List<GameSummaryResponseDto> getTrendingGamesWide() {
    return igdbClient.fetchTrendingGames(WIDE_LIMIT).stream()
        .map(IgdbMapper::toGameSummary)
        .toList();
  }

  public List<GameSummaryResponseDto> getTopRatedGamesWide() {
    return igdbClient.fetchTopRatedGames(TOP_RATED_MIN_RATINGS, WIDE_LIMIT).stream()
        .map(IgdbMapper::toGameSummary)
        .toList();
  }

  public List<GameSummaryResponseDto> getUpcomingGamesWide() {
    Instant now = Instant.now();
    return igdbClient
        .fetchUpcomingGames(now, now.plus(UPCOMING_WINDOW_DAYS, ChronoUnit.DAYS), UPCOMING_LIMIT)
        .stream()
        .map(IgdbMapper::toGameSummary)
        .toList();
  }

  public List<GameSummaryResponseDto> getNewGamesWide() {
    Instant now = Instant.now();
    return igdbClient
        .fetchNewGames(now.minus(NEW_RELEASE_WINDOW_DAYS, ChronoUnit.DAYS), now, WIDE_LIMIT)
        .stream()
        .map(IgdbMapper::toGameSummary)
        .toList();
  }

  public List<GameSummaryResponseDto> searchGames(String query, boolean includeAdult, int page) {
    return igdbClient.searchGames(query, includeAdult, page).stream()
        .map(IgdbMapper::toGameSummary)
        .toList();
  }

  public GameDetailResponseDto getGame(long id) {
    return providerCache.get(
        ProviderCacheSpace.IGDB_GAME,
        String.valueOf(id),
        GameDetailResponseDto.class,
        () -> {
          IgdbGameResponseDto payload = igdbClient.fetchGame(id);
          List<IgdbGameResponseDto> dlcs = igdbClient.fetchDlcGames(id);
          return IgdbMapper.toGameDetail(payload, dlcs);
        });
  }

  public List<GameSummaryResponseDto> getGameSummariesByIds(List<Long> ids) {
    return igdbClient.fetchGamesByIds(ids).stream().map(IgdbMapper::toGameSummary).toList();
  }

  public CompanyDetailResponseDto getCompany(long id) {
    var payload =
        igdbClient
            .findCompany(id)
            .orElseThrow(
                () ->
                    new ResourceNotFoundException(
                        ErrorCode.IGDB_RESOURCE_NOT_FOUND, "IGDB company not found"));
    return new CompanyDetailResponseDto(
        payload.id(), payload.name(), payload.description(), payload.logoImageId(), payload.url());
  }

  public MediaPageResponseDto<GameSummaryResponseDto> getCompanyGames(
      long companyId, boolean includeAdult, int page) {
    List<Long> devIds = igdbClient.fetchInvolvedCompanyIds(companyId, true);
    List<Long> pubIds = igdbClient.fetchInvolvedCompanyIds(companyId, false);
    var allIds = new LinkedHashSet<Long>(devIds);
    allIds.addAll(pubIds);
    List<IgdbGameResponseDto> games =
        igdbClient.fetchGamesByInvolvedCompanies(new ArrayList<>(allIds), includeAdult, page);
    return toMediaPage(games);
  }

  public FranchiseDetailResponseDto getFranchise(long id) {
    var payload =
        igdbClient
            .findFranchise(id)
            .orElseThrow(
                () ->
                    new ResourceNotFoundException(
                        ErrorCode.IGDB_RESOURCE_NOT_FOUND, "IGDB franchise not found"));
    List<IgdbGameResponseDto> games = igdbClient.fetchFranchiseGamesPaged(id, true, 0);
    List<GameSummaryResponseDto> gameResults =
        games.stream().map(IgdbMapper::toGameSummary).toList();
    return new FranchiseDetailResponseDto(id, payload.name(), gameResults);
  }

  public MediaPageResponseDto<GameSummaryResponseDto> getFranchiseGames(
      long franchiseId, boolean includeAdult, int page) {
    List<IgdbGameResponseDto> games =
        igdbClient.fetchFranchiseGamesPaged(franchiseId, includeAdult, page);
    return toMediaPage(games);
  }

  public MediaPageResponseDto<GameSummaryResponseDto> getGamesByGenre(
      long genreId, boolean includeAdult, int page) {
    List<IgdbGameResponseDto> games =
        igdbClient.fetchGamesByFacet("genres", genreId, includeAdult, page);
    return toMediaPage(games);
  }

  public MediaPageResponseDto<GameSummaryResponseDto> getGamesByPlatform(
      long platformId, boolean includeAdult, int page) {
    List<IgdbGameResponseDto> games =
        igdbClient.fetchGamesByFacet("platforms", platformId, includeAdult, page);
    return toMediaPage(games);
  }

  public MediaPageResponseDto<GameSummaryResponseDto> getGamesByTheme(
      long themeId, boolean includeAdult, int page) {
    List<IgdbGameResponseDto> games =
        igdbClient.fetchGamesByFacet("themes", themeId, includeAdult, page);
    return toMediaPage(games);
  }

  public MediaPageResponseDto<GameSummaryResponseDto> getGamesByGameMode(
      long gameModeId, boolean includeAdult, int page) {
    List<IgdbGameResponseDto> games =
        igdbClient.fetchGamesByFacet("game_modes", gameModeId, includeAdult, page);
    return toMediaPage(games);
  }

  private MediaPageResponseDto<GameSummaryResponseDto> toMediaPage(
      List<IgdbGameResponseDto> games) {
    List<GameSummaryResponseDto> results =
        games.stream().limit(PAGE_SIZE).map(IgdbMapper::toGameSummary).toList();
    return new MediaPageResponseDto<>(results, games.size() > PAGE_SIZE);
  }

  public MediaPageResponseDto<GameSummaryResponseDto> explore(IgdbExploreQuery query) {
    List<IgdbGameResponseDto> games = igdbClient.explore(query.withLimit(query.limit() + 1));
    return new MediaPageResponseDto<>(
        games.stream().limit(query.limit()).map(IgdbMapper::toGameSummary).toList(),
        games.size() > query.limit());
  }

  @Cacheable(CacheConfig.IGDB_FACETS)
  public List<IgdbFacetDto> getFacets(IgdbFacetKind kind, String search) {
    return igdbClient.fetchFacets(kind.endpoint(), search).stream()
        .map(facet -> new IgdbFacetDto(facet.id(), facet.name()))
        .toList();
  }

  @Cacheable(CacheConfig.IGDB_KEYWORD_IDS)
  public Optional<Long> findKeywordId(String slug) {
    return igdbClient.fetchKeywordsBySlug(List.of(slug)).stream()
        .map(IgdbFacetResponseDto::id)
        .findFirst();
  }
}
