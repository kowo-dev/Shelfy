package com.shelfy.api.common.cache;

import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ProviderCacheCleanupJob {

  private static final Logger LOG = LoggerFactory.getLogger(ProviderCacheCleanupJob.class);

  private final ProviderCacheStore store;

  @Scheduled(cron = "0 45 3 * * *")
  public void purgeExpiredEntries() {
    Instant now = Instant.now();
    int purged = 0;
    for (ProviderCacheSpace space : ProviderCacheSpace.values()) {
      purged += store.purgeOlderThan(space.namespace(), now.minus(space.keptFor()));
    }
    LOG.info("Purged {} expired provider cache entries", purged);
  }
}
