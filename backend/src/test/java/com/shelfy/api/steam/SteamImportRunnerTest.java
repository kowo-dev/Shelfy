package com.shelfy.api.steam;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.shelfy.api.collection.CanonicalWorkEntity;
import com.shelfy.api.collection.CollectionService;
import com.shelfy.api.collection.MediaCatalogService;
import com.shelfy.api.collection.MediaEntity;
import com.shelfy.api.collection.MediaType;
import com.shelfy.api.collection.UserMediaRepository;
import com.shelfy.api.common.ImportStatus;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.igdb.IgdbProperties;
import com.shelfy.api.igdb.IgdbService;
import com.shelfy.api.igdb.client.IgdbClient;
import com.shelfy.api.igdb.client.IgdbExternalGameRefResponseDto;
import com.shelfy.api.igdb.client.IgdbExternalGameResponseDto;
import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.steam.client.SteamClient;
import com.shelfy.api.steam.client.SteamOwnedGameResponseDto;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SteamImportRunnerTest {

  private final SteamImportJobRepository jobRepository = mock(SteamImportJobRepository.class);
  private final SteamImportEntryRepository entryRepository = mock(SteamImportEntryRepository.class);
  private final UserMediaRepository userMediaRepository = mock(UserMediaRepository.class);
  private final CollectionService collectionService = mock(CollectionService.class);
  private final SteamClient steamClient = mock(SteamClient.class);
  private final IgdbClient igdbClient = mock(IgdbClient.class);
  private final IgdbService igdbService = mock(IgdbService.class);
  private final SteamImportRunner runner =
      new SteamImportRunner(
          jobRepository,
          entryRepository,
          userMediaRepository,
          collectionService,
          mock(MediaCatalogService.class),
          steamClient,
          igdbClient,
          igdbService,
          new IgdbProperties("", "", "https://images.igdb.com/", "id", "secret"),
          mock(NotificationService.class));

  @Test
  void run_keepsImportingWhenOneGameFails() {
    UUID userId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();
    SteamImportJobEntity job = new SteamImportJobEntity(userId, "steam-1");
    when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));
    List<SteamImportEntryEntity> entries = new ArrayList<>();
    when(entryRepository.saveAll(anyList()))
        .thenAnswer(
            invocation -> {
              entries.addAll(invocation.getArgument(0));
              return invocation.getArgument(0);
            });
    when(steamClient.fetchOwnedGames("steam-1"))
        .thenReturn(
            List.of(
                new SteamOwnedGameResponseDto(10, "Portal"),
                new SteamOwnedGameResponseDto(20, "Broken Game"),
                new SteamOwnedGameResponseDto(30, "Unknown Game")));
    when(igdbClient.fetchExternalGamesBySteamAppId(anyList()))
        .thenReturn(
            List.of(
                new IgdbExternalGameResponseDto("10", game(71, "Portal"), 1),
                new IgdbExternalGameResponseDto("20", game(72, "Broken Game"), 1)));
    when(igdbService.getGameSummariesByIds(anyList())).thenReturn(List.of());
    when(collectionService.findOrCreateMedia(
            eq("71"),
            eq("igdb"),
            eq(MediaType.GAME),
            anyString(),
            any(),
            anyMap(),
            anyBoolean(),
            anySet()))
        .thenReturn(media("71"));
    when(collectionService.findOrCreateMedia(
            eq("72"),
            eq("igdb"),
            eq(MediaType.GAME),
            anyString(),
            any(),
            anyMap(),
            anyBoolean(),
            anySet()))
        .thenThrow(new IllegalStateException("duplicate key value violates unique constraint"));

    runner.run(jobId, userId, "steam-1");

    assertEquals(ImportStatus.COMPLETED, job.getStatus());
    assertEquals(1, job.getEntriesImported());
    assertEquals(2, job.getEntriesSkipped());
    SteamImportEntryEntity broken =
        entries.stream().filter(e -> e.getSteamAppId() == 20).findFirst().orElseThrow();
    assertEquals("processing_error", broken.getReason());
    assertEquals(ErrorCode.INTERNAL_SERVER_ERROR.name(), broken.getReasonDetail());
    assertEquals(
        "no_igdb_match",
        entries.stream()
            .filter(e -> e.getSteamAppId() == 30)
            .findFirst()
            .orElseThrow()
            .getReason());
  }

  private static IgdbExternalGameRefResponseDto game(long id, String name) {
    return new IgdbExternalGameRefResponseDto(id, name, 0, null, null);
  }

  private static MediaEntity media(String igdbId) {
    MediaEntity media =
        new MediaEntity(
            igdbId,
            "igdb",
            MediaType.GAME,
            new CanonicalWorkEntity(MediaType.GAME),
            igdbId,
            null,
            Map.of(),
            false);
    media.setId(UUID.randomUUID());
    return media;
  }
}
