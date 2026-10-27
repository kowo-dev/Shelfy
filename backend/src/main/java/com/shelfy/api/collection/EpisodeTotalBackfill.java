package com.shelfy.api.collection;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class EpisodeTotalBackfill {

  private static final Logger LOG = LoggerFactory.getLogger(EpisodeTotalBackfill.class);

  private final EpisodeProgressService episodeProgressService;
  private final Set<UUID> inFlight = ConcurrentHashMap.newKeySet();

  @Async
  public void fill(UUID mediaId) {
    if (!inFlight.add(mediaId)) {
      return;
    }
    try {
      episodeProgressService.fillMissingTotal(mediaId);
    } catch (RuntimeException ex) {
      LOG.debug("Episode total for media {} still unavailable: {}", mediaId, ex.getMessage());
    } finally {
      inFlight.remove(mediaId);
    }
  }
}
