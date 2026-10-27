package com.shelfy.api.steam;

import com.shelfy.api.collection.MediaCatalogService;
import com.shelfy.api.collection.MediaEntity;
import com.shelfy.api.collection.MediaRepository;
import com.shelfy.api.collection.MediaType;
import com.shelfy.api.igdb.IgdbService;
import com.shelfy.api.igdb.dto.GameSummaryResponseDto;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("backfill-steam-game-metadata")
@RequiredArgsConstructor
public class SteamGameMetadataBackfillRunner implements CommandLineRunner {

  private static final Logger log = LoggerFactory.getLogger(SteamGameMetadataBackfillRunner.class);
  private static final String IGDB_PROVIDER = "igdb";
  private static final String VOTE_AVERAGE_KEY = "voteAverage";
  private static final String BACKDROP_URL_KEY = "backdropUrl";
  private static final int BATCH_SIZE = 50;

  private final MediaRepository mediaRepository;
  private final MediaCatalogService mediaCatalogService;
  private final IgdbService igdbService;

  @Override
  public void run(String... args) {
    List<MediaEntity> games =
        mediaRepository.findByProviderAndMediaType(IGDB_PROVIDER, MediaType.GAME);
    List<MediaEntity> missing = games.stream().filter(this::missingMetadata).toList();

    log.info(
        "Steam game metadata backfill: {} of {} igdb games missing voteAverage or backdropUrl",
        missing.size(),
        games.size());

    int updated = 0;
    for (int i = 0; i < missing.size(); i += BATCH_SIZE) {
      List<MediaEntity> batch = missing.subList(i, Math.min(i + BATCH_SIZE, missing.size()));
      updated += backfillBatch(batch);
      log.info(
          "Steam game metadata backfill: processed {}/{}",
          Math.min(i + BATCH_SIZE, missing.size()),
          missing.size());
    }

    log.info(
        "Steam game metadata backfill complete: updated {} of {} media rows",
        updated,
        missing.size());
  }

  @Transactional
  int backfillBatch(List<MediaEntity> batch) {
    List<Long> ids = batch.stream().map(media -> Long.parseLong(media.getExternalId())).toList();
    Map<Long, GameSummaryResponseDto> summariesById =
        igdbService.getGameSummariesByIds(ids).stream()
            .collect(Collectors.toMap(GameSummaryResponseDto::id, Function.identity()));

    int updated = 0;
    for (MediaEntity media : batch) {
      GameSummaryResponseDto summary = summariesById.get(Long.parseLong(media.getExternalId()));
      if (summary == null) {
        log.warn(
            "No IGDB summary found for media {} (externalId={})",
            media.getId(),
            media.getExternalId());
        continue;
      }
      Map<String, Object> merged = new HashMap<>(media.getMetadata());
      merged.putAll(mediaCatalogService.buildGameMetadata(summary));
      media.setMetadata(merged);
      updated++;
    }
    mediaRepository.saveAll(batch);
    return updated;
  }

  private boolean missingMetadata(MediaEntity media) {
    Map<String, Object> metadata = media.getMetadata();
    return metadata == null
        || !metadata.containsKey(VOTE_AVERAGE_KEY)
        || !metadata.containsKey(BACKDROP_URL_KEY);
  }
}
