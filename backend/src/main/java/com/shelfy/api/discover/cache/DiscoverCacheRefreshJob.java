package com.shelfy.api.discover.cache;

import com.shelfy.api.common.http.ProviderRateLimiter;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
    name = "app.discover.refresh-enabled",
    havingValue = "true",
    matchIfMissing = true)
@RequiredArgsConstructor
public class DiscoverCacheRefreshJob {

  private static final Duration PROVIDER_WAIT = Duration.ofMinutes(1);

  private final DiscoverCacheService discoverCacheService;

  @Async
  @EventListener(ApplicationReadyEvent.class)
  public void refreshOnStartup() {
    refreshAll();
  }

  @Scheduled(cron = "0 0 4 * * *")
  public void refresh() {
    refreshAll();
  }

  private void refreshAll() {
    ScopedValue.where(ProviderRateLimiter.MAX_WAIT, PROVIDER_WAIT)
        .run(discoverCacheService::refreshAll);
  }
}
