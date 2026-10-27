package com.shelfy.api.igdb;

import com.shelfy.api.collection.MediaType;
import com.shelfy.api.igdb.client.IgdbClient;
import com.shelfy.api.igdb.client.IgdbCompanyResponseDto;
import com.shelfy.api.igdb.client.IgdbGameResponseDto;
import com.shelfy.api.igdb.client.IgdbInvolvedCompanyResponseDto;
import com.shelfy.api.igdb.dto.GameSummaryResponseDto;
import com.shelfy.api.related.RelatedMediaSource;
import com.shelfy.api.related.RelatedSection;
import com.shelfy.api.related.RelatedSectionFetcher;
import com.shelfy.api.related.dto.RelatedEntityDto;
import com.shelfy.api.related.dto.RelatedSectionResponseDto;
import com.shelfy.api.related.dto.SimilarMediaResponseDto;
import com.shelfy.api.search.dto.SearchResultResponseDto;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class IgdbRelatedSource implements RelatedMediaSource {

  private static final String PROVIDER = "igdb";

  private final IgdbClient igdbClient;
  private final RelatedSectionFetcher fetcher;

  @Override
  public boolean supports(MediaType mediaType) {
    return mediaType == MediaType.GAME;
  }

  @Override
  public List<RelatedSectionResponseDto> sections(MediaType mediaType, String externalId) {
    long id = Long.parseLong(externalId);
    IgdbGameResponseDto game = igdbClient.fetchGameRelated(id);
    List<Supplier<Optional<RelatedSectionResponseDto>>> lookups = new ArrayList<>();
    lookups.add(() -> Optional.of(RelatedSection.similar(similarGames(game), false)));
    franchiseId(game).ifPresent(franchiseId -> lookups.add(() -> franchise(game, franchiseId, id)));
    developer(game)
        .ifPresent(
            developer ->
                lookups.add(
                    () ->
                        Optional.of(
                            RelatedSection.entity(
                                new RelatedEntityDto(
                                    "game-companies",
                                    String.valueOf(developer.id()),
                                    developer.name(),
                                    "developer"),
                                items(
                                    igdbClient.fetchDeveloperTopGames(developer.id()).stream()
                                        .map(IgdbMapper::toGameSummary)
                                        .toList())))));
    return fetcher.fetchAll(lookups);
  }

  @Override
  public SimilarMediaResponseDto similar(MediaType mediaType, String externalId, int page) {
    if (page > 1) {
      return new SimilarMediaResponseDto(List.of(), page, false);
    }
    IgdbGameResponseDto game = igdbClient.fetchGameRelated(Long.parseLong(externalId));
    return new SimilarMediaResponseDto(similarGames(game), page, false);
  }

  private static List<SearchResultResponseDto> similarGames(IgdbGameResponseDto game) {
    if (game.similarGames() == null) {
      return List.of();
    }
    return items(game.similarGames().stream().map(IgdbMapper::toGameSummary).toList());
  }

  private Optional<RelatedSectionResponseDto> franchise(
      IgdbGameResponseDto game, long franchiseId, long gameId) {
    String name =
        game.franchise() != null && game.franchise().id() == franchiseId
            ? game.franchise().name()
            : igdbClient.findFranchise(franchiseId).map(franchise -> franchise.name()).orElse(null);
    if (name == null) {
      return Optional.empty();
    }
    List<GameSummaryResponseDto> games =
        igdbClient.fetchFranchiseTopGames(franchiseId, gameId).stream()
            .map(IgdbMapper::toGameSummary)
            .sorted(
                Comparator.comparing(
                    GameSummaryResponseDto::releaseDate,
                    Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();
    return Optional.of(
        RelatedSection.franchise(
            name,
            new RelatedEntityDto("franchises", String.valueOf(franchiseId), name, "franchise"),
            items(games)));
  }

  private static Optional<Long> franchiseId(IgdbGameResponseDto game) {
    if (game.franchise() != null) {
      return Optional.of(game.franchise().id());
    }
    if (game.franchises() != null && !game.franchises().isEmpty()) {
      return Optional.of(game.franchises().getFirst());
    }
    return Optional.empty();
  }

  private static Optional<IgdbCompanyResponseDto> developer(IgdbGameResponseDto game) {
    if (game.involvedCompanies() == null) {
      return Optional.empty();
    }
    return game.involvedCompanies().stream()
        .filter(involved -> Boolean.TRUE.equals(involved.developer()))
        .map(IgdbInvolvedCompanyResponseDto::company)
        .filter(Objects::nonNull)
        .filter(company -> company.name() != null)
        .findFirst();
  }

  private static List<SearchResultResponseDto> items(List<GameSummaryResponseDto> games) {
    return games.stream()
        .filter(game -> !game.isAdult() && game.name() != null)
        .map(
            game ->
                new SearchResultResponseDto(
                    PROVIDER,
                    MediaType.GAME,
                    String.valueOf(game.id()),
                    game.name(),
                    game.coverImageId(),
                    game.summary(),
                    game.releaseDate() == null ? null : game.releaseDate().getYear(),
                    game.genres(),
                    game.rating(),
                    game.ratingCount(),
                    null,
                    false))
        .toList();
  }
}
