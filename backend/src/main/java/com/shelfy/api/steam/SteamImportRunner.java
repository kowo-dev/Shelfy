package com.shelfy.api.steam;

import com.shelfy.api.collection.CollectionService;
import com.shelfy.api.collection.ExternalMediaReference;
import com.shelfy.api.collection.MediaCatalogService;
import com.shelfy.api.collection.MediaEntity;
import com.shelfy.api.collection.MediaType;
import com.shelfy.api.collection.UserMediaEntity;
import com.shelfy.api.collection.UserMediaRepository;
import com.shelfy.api.collection.UserMediaStatus;
import com.shelfy.api.common.ImportEntryStatus;
import com.shelfy.api.common.ImportJobTracker;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.http.LogSafe;
import com.shelfy.api.igdb.IgdbProperties;
import com.shelfy.api.igdb.IgdbService;
import com.shelfy.api.igdb.client.IgdbClient;
import com.shelfy.api.igdb.client.IgdbExternalGameRefResponseDto;
import com.shelfy.api.igdb.client.IgdbExternalGameResponseDto;
import com.shelfy.api.igdb.client.IgdbImageResponseDto;
import com.shelfy.api.igdb.dto.GameSummaryResponseDto;
import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.notifications.NotificationType;
import com.shelfy.api.steam.client.SteamClient;
import com.shelfy.api.steam.client.SteamOwnedGameResponseDto;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Component
public class SteamImportRunner {

  private static final Logger LOG = LoggerFactory.getLogger(SteamImportRunner.class);

  private static final int BATCH_SIZE = 10;
  private static final long BATCH_DELAY_MS = 200;
  private static final Set<Integer> VALID_IGDB_GAME_TYPES = Set.of(0, 1, 2, 3, 4, 8, 9, 10, 11);
  private static final Set<Long> IGNORED_APP_IDS =
      Set.of(431960L, 228980L, 365670L, 250820L, 22330L);
  private static final List<String> NAME_BLACKLIST =
      List.of(
          "playtest",
          "dedicated server",
          "trial",
          "demo",
          "server",
          "tool",
          "sdk",
          "redistributable",
          "soundtrack",
          "artbook",
          "benchmark",
          "beta",
          "wallpaper engine");

  private final ImportJobTracker<SteamImportJobEntity> jobs;
  private final SteamImportEntryRepository entryRepository;
  private final UserMediaRepository userMediaRepository;
  private final CollectionService collectionService;
  private final MediaCatalogService mediaCatalogService;
  private final SteamClient steamClient;
  private final IgdbClient igdbClient;
  private final IgdbService igdbService;
  private final IgdbProperties igdbProperties;
  private final NotificationService notificationService;

  public SteamImportRunner(
      SteamImportJobRepository jobRepository,
      SteamImportEntryRepository entryRepository,
      UserMediaRepository userMediaRepository,
      CollectionService collectionService,
      MediaCatalogService mediaCatalogService,
      SteamClient steamClient,
      IgdbClient igdbClient,
      IgdbService igdbService,
      IgdbProperties igdbProperties,
      NotificationService notificationService) {
    this.jobs = new ImportJobTracker<>(jobRepository);
    this.entryRepository = entryRepository;
    this.userMediaRepository = userMediaRepository;
    this.collectionService = collectionService;
    this.mediaCatalogService = mediaCatalogService;
    this.steamClient = steamClient;
    this.igdbClient = igdbClient;
    this.igdbService = igdbService;
    this.igdbProperties = igdbProperties;
    this.notificationService = notificationService;
  }

  @Async("steamImportExecutor")
  public void run(UUID jobId, UUID userId, String steamId) {
    try {
      doRun(jobId, userId, steamId);
    } catch (Exception ex) {
      LOG.error("Steam import {} failed: {}", jobId, LogSafe.describe(ex));
      jobs.fail(jobId, ErrorCode.of(ex).name());
      notifyFailure(userId, ErrorCode.of(ex).name());
    }
  }

  private void doRun(UUID jobId, UUID userId, String steamId) {
    jobs.start(jobId);

    List<SteamOwnedGameResponseDto> ownedGames = steamClient.fetchOwnedGames(steamId);
    List<SteamOwnedGameResponseDto> games =
        ownedGames.stream().filter(game -> !isIgnorable(game)).toList();
    jobs.total(jobId, games.size());

    Set<UUID> ownedMediaIds = new HashSet<>(userMediaRepository.findMediaIdsByUserId(userId));
    int imported = 0;
    int skipped = 0;

    for (int i = 0; i < games.size(); i += BATCH_SIZE) {
      List<SteamOwnedGameResponseDto> batch =
          games.subList(i, Math.min(i + BATCH_SIZE, games.size()));
      List<Long> appIds = batch.stream().map(SteamOwnedGameResponseDto::appid).toList();
      List<IgdbExternalGameResponseDto> matches = igdbClient.fetchExternalGamesBySteamAppId(appIds);
      Map<Long, GameSummaryResponseDto> ratingsByGameId = fetchRatings(matches);

      List<SteamImportEntryEntity> entries = new ArrayList<>();
      for (SteamOwnedGameResponseDto game : batch) {
        BatchOutcome outcome;
        try {
          outcome = importOne(jobId, userId, game, matches, ratingsByGameId, ownedMediaIds);
        } catch (RuntimeException ex) {
          LOG.warn(
              "Steam import {} could not import app {}: {}",
              jobId,
              game.appid(),
              LogSafe.describe(ex));
          outcome =
              new BatchOutcome(
                  skippedEntry(
                      jobId,
                      userId,
                      game,
                      "processing_error",
                      ErrorCode.of(ex).name(),
                      null,
                      null,
                      null),
                  false);
        }
        entries.add(outcome.entry());
        if (outcome.isImported()) {
          imported++;
        } else {
          skipped++;
        }
      }

      entryRepository.saveAll(entries);
      jobs.progress(jobId, imported, skipped);

      if (i + BATCH_SIZE < games.size()) {
        sleep();
      }
    }

    jobs.complete(jobId);
    notificationService.create(
        userId,
        null,
        NotificationType.IMPORT_FINISHED,
        null,
        null,
        Map.of("source", "STEAM", "imported", imported, "skipped", skipped));
  }

  private record BatchOutcome(SteamImportEntryEntity entry, boolean isImported) {}

  private Map<Long, GameSummaryResponseDto> fetchRatings(
      List<IgdbExternalGameResponseDto> matches) {
    List<Long> gameIds =
        matches.stream()
            .map(IgdbExternalGameResponseDto::game)
            .filter(Objects::nonNull)
            .map(IgdbExternalGameRefResponseDto::id)
            .distinct()
            .toList();
    if (gameIds.isEmpty()) {
      return Map.of();
    }
    return igdbService.getGameSummariesByIds(gameIds).stream()
        .collect(Collectors.toMap(GameSummaryResponseDto::id, Function.identity()));
  }

  private BatchOutcome importOne(
      UUID jobId,
      UUID userId,
      SteamOwnedGameResponseDto game,
      List<IgdbExternalGameResponseDto> matches,
      Map<Long, GameSummaryResponseDto> ratingsByGameId,
      Set<UUID> ownedMediaIds) {
    IgdbExternalGameRefResponseDto igdbGame =
        matches.stream()
            .filter(match -> String.valueOf(game.appid()).equals(match.uid()))
            .map(IgdbExternalGameResponseDto::game)
            .findFirst()
            .orElse(null);

    if (igdbGame == null) {
      return new BatchOutcome(
          skippedEntry(jobId, userId, game, "no_igdb_match", null, null, null, null), false);
    }

    if (!VALID_IGDB_GAME_TYPES.contains(igdbGame.gameType())) {
      return new BatchOutcome(
          skippedEntry(
              jobId,
              userId,
              game,
              "invalid_game_type",
              igdbGame.name(),
              null,
              igdbGame.id(),
              igdbGame.name()),
          false);
    }

    MediaEntity media =
        collectionService.findOrCreateMedia(
            String.valueOf(igdbGame.id()),
            "igdb",
            MediaType.GAME,
            igdbGame.name(),
            igdbCoverUrl(igdbGame.cover()),
            gameMetadata(game, ratingsByGameId.get(igdbGame.id())),
            false,
            Set.of(new ExternalMediaReference("steam", String.valueOf(game.appid()))));

    if (ownedMediaIds.contains(media.getId())) {
      return new BatchOutcome(
          skippedEntry(
              jobId,
              userId,
              game,
              "already_in_collection",
              igdbGame.name(),
              media.getId(),
              igdbGame.id(),
              igdbGame.name()),
          false);
    }

    userMediaRepository.save(
        new UserMediaEntity(userId, media, UserMediaStatus.PLANNED, null, Map.of()));
    ownedMediaIds.add(media.getId());

    return new BatchOutcome(
        new SteamImportEntryEntity(
            jobId,
            userId,
            game.appid(),
            game.name(),
            ImportEntryStatus.IMPORTED,
            null,
            null,
            media.getId(),
            igdbGame.id(),
            igdbGame.name()),
        true);
  }

  private SteamImportEntryEntity skippedEntry(
      UUID jobId,
      UUID userId,
      SteamOwnedGameResponseDto game,
      String reason,
      String reasonDetail,
      UUID mediaId,
      Long igdbId,
      String igdbName) {
    return new SteamImportEntryEntity(
        jobId,
        userId,
        game.appid(),
        game.name(),
        ImportEntryStatus.SKIPPED,
        reason,
        reasonDetail,
        mediaId,
        igdbId,
        igdbName);
  }

  private Map<String, Object> gameMetadata(
      SteamOwnedGameResponseDto game, GameSummaryResponseDto rating) {
    Map<String, Object> metadata = new HashMap<>();
    metadata.put("steamAppId", game.appid());
    if (rating != null) {
      metadata.putAll(mediaCatalogService.buildGameMetadata(rating));
    }
    return metadata;
  }

  private String igdbCoverUrl(IgdbImageResponseDto cover) {
    if (cover == null || cover.url() == null) {
      return null;
    }
    String url = cover.url();
    int lastSlash = url.lastIndexOf('/');
    String fileName = lastSlash >= 0 ? url.substring(lastSlash + 1) : url;
    int dotIndex = fileName.lastIndexOf('.');
    String imageId = dotIndex >= 0 ? fileName.substring(0, dotIndex) : fileName;
    return igdbProperties.imageBaseUrl() + imageId + ".jpg";
  }

  private boolean isIgnorable(SteamOwnedGameResponseDto game) {
    if (IGNORED_APP_IDS.contains(game.appid())) {
      return true;
    }
    String normalized = game.name() == null ? "" : game.name().toLowerCase(Locale.ROOT);
    return NAME_BLACKLIST.stream().anyMatch(normalized::contains);
  }

  private void sleep() {
    try {
      Thread.sleep(BATCH_DELAY_MS);
    } catch (InterruptedException ex) {
      Thread.currentThread().interrupt();
    }
  }

  private void notifyFailure(UUID userId, String code) {
    notificationService.create(
        userId,
        null,
        NotificationType.IMPORT_FAILED,
        null,
        null,
        Map.of("source", "STEAM", "code", code));
  }
}
