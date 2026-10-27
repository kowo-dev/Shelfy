package com.shelfy.api.federation;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnBooleanProperty("app.federation.enabled")
@RequiredArgsConstructor
public class FederationJobs {

  private static final Duration INBOX_SEEN_RETENTION = Duration.ofDays(7);

  private final DeliveryService deliveryService;
  private final JdbcClient jdbcClient;

  @Scheduled(fixedDelay = 5_000, initialDelay = 10_000)
  public void deliver() {
    int delivered;
    do {
      delivered = deliveryService.deliverDue();
    } while (delivered == DeliveryService.BATCH_SIZE);
  }

  @Scheduled(cron = "0 15 4 * * *")
  public void pruneInboxSeen() {
    jdbcClient
        .sql("delete from ap_inbox_seen where seen_at < :cutoff")
        .param("cutoff", Instant.now().minus(INBOX_SEEN_RETENTION).atOffset(ZoneOffset.UTC))
        .update();
  }
}
