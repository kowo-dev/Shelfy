package com.shelfy.api.collection;

import com.shelfy.api.anilist.AniListService;
import com.shelfy.api.auth.ViewerPreferences;
import com.shelfy.api.collection.dto.CollectionItemResponseDto;
import com.shelfy.api.collection.dto.NextEpisodeResponseDto;
import com.shelfy.api.common.dto.NextAiringDto;
import com.shelfy.api.tmdb.TmdbService;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class NextEpisodeService implements AutoCloseable {

  static final int MAX_ITEMS = 40;
  static final int WINDOW_DAYS = 21;
  private static final String TMDB_PROVIDER = "tmdb";
  private static final String ANILIST_PROVIDER = "anilist";
  private static final Logger LOG = LoggerFactory.getLogger(NextEpisodeService.class);
  private static final Comparator<NextEpisodeResponseDto> BY_AIRING =
      Comparator.comparing(NextEpisodeResponseDto::airDate)
          .thenComparing(
              NextEpisodeResponseDto::airingAt, Comparator.nullsLast(Comparator.naturalOrder()))
          .thenComparing(next -> next.item().media().title());

  private final CollectionService collectionService;
  private final TmdbService tmdbService;
  private final AniListService aniListService;
  private final ViewerPreferences viewerPreferences;
  private final Clock clock;
  private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

  @Autowired
  public NextEpisodeService(
      CollectionService collectionService,
      TmdbService tmdbService,
      AniListService aniListService,
      ViewerPreferences viewerPreferences) {
    this(collectionService, tmdbService, aniListService, viewerPreferences, Clock.systemUTC());
  }

  NextEpisodeService(
      CollectionService collectionService,
      TmdbService tmdbService,
      AniListService aniListService,
      ViewerPreferences viewerPreferences,
      Clock clock) {
    this.collectionService = collectionService;
    this.tmdbService = tmdbService;
    this.aniListService = aniListService;
    this.viewerPreferences = viewerPreferences;
    this.clock = clock;
  }

  public List<NextEpisodeResponseDto> getNextEpisodes(UUID userId) {
    boolean adultContentAllowed = viewerPreferences.allowsAdultContent(userId);
    LocalDate today = LocalDate.now(clock);
    LocalDate until = today.plusDays(WINDOW_DAYS);
    List<CompletableFuture<NextEpisodeResponseDto>> lookups =
        collectionService.getOngoingItems(userId, MAX_ITEMS).stream()
            .filter(item -> adultContentAllowed || !item.media().isAdult())
            .filter(NextEpisodeService::airsEpisodes)
            .map(item -> CompletableFuture.supplyAsync(() -> next(item), executor))
            .toList();
    return lookups.stream()
        .map(CompletableFuture::join)
        .filter(Objects::nonNull)
        .filter(next -> !next.airDate().isBefore(today) && !next.airDate().isAfter(until))
        .sorted(BY_AIRING)
        .toList();
  }

  private static boolean airsEpisodes(CollectionItemResponseDto item) {
    return switch (item.media().mediaType()) {
      case TV_SHOW -> TMDB_PROVIDER.equals(item.media().provider());
      case ANIME -> ANILIST_PROVIDER.equals(item.media().provider());
      default -> false;
    };
  }

  private NextEpisodeResponseDto next(CollectionItemResponseDto item) {
    try {
      long id = Long.parseLong(item.media().externalId());
      NextAiringDto airing =
          item.media().mediaType() == MediaType.TV_SHOW
              ? tmdbService.getNextEpisode(id)
              : aniListService.getNextAiring(id);
      if (airing == null || !airing.scheduled()) {
        return null;
      }
      return new NextEpisodeResponseDto(
          item,
          airing.season(),
          airing.episode(),
          airing.title(),
          airing.airDate(),
          airing.airingAt(),
          airing.stillPath());
    } catch (RuntimeException ex) {
      LOG.debug("Skipping next episode of {}: {}", item.id(), ex.getMessage());
      return null;
    }
  }

  @Override
  public void close() {
    executor.close();
  }
}
