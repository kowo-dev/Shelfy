package com.shelfy.api.notifications;

import java.time.Duration;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class NotificationRetentionJob {

  private static final Logger LOG = LoggerFactory.getLogger(NotificationRetentionJob.class);
  private static final Duration RETENTION = Duration.ofDays(90);

  private final NotificationRepository repository;

  @Scheduled(cron = "0 0 4 * * *")
  @Transactional
  public void purgeReadNotifications() {
    int purged =
        repository.purgeReadBefore(Instant.now().minus(RETENTION), NotificationType.requests());
    LOG.info("Purged {} read notifications", purged);
  }
}
