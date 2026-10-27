package com.shelfy.api.activity;

import com.shelfy.api.collection.UserMediaEntity;
import com.shelfy.api.federation.ActivityPublisher;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserActivityService {
  private static final Duration MERGE_WINDOW = Duration.ofHours(1);

  private final UserActivityRepository repository;
  private final ActivityPublisher publisher;

  public void record(UserMediaEntity item, ActivityType type, Map<String, Object> payload) {
    Instant cutoff = Instant.now().minus(MERGE_WINDOW);
    Optional<UserActivityEntity> recent =
        repository.findFirstByUserMedia_IdAndActivityTypeAndCreatedAtAfterOrderByCreatedAtDesc(
            item.getId(), type, cutoff);
    if (recent.isPresent()) {
      UserActivityEntity existing = recent.get();
      existing.merge(payload);
      publisher.published(repository.save(existing), false);
      return;
    }
    publisher.published(
        repository.save(new UserActivityEntity(item.getUserId(), item, type, payload)), true);
  }

  public void record(UUID userId, ActivityType type, Map<String, Object> payload) {
    repository.save(new UserActivityEntity(userId, null, type, payload));
  }

  public Page<UserActivityEntity> listForUser(UUID userId, Pageable pageable) {
    return repository.findByUserId(userId, pageable);
  }

  public void deleteForMedia(UUID userMediaId) {
    deleteForMedia(List.of(userMediaId));
  }

  public void deleteForMedia(List<UUID> userMediaIds) {
    if (userMediaIds.isEmpty()) {
      return;
    }
    publisher.deleted(repository.findByUserMedia_IdIn(userMediaIds));
    repository.deleteByUserMedia_IdIn(userMediaIds);
  }
}
