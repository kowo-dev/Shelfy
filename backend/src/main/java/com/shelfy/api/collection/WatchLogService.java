package com.shelfy.api.collection;

import com.shelfy.api.activity.ActivityType;
import com.shelfy.api.activity.UserActivityService;
import com.shelfy.api.collection.dto.UpsertWatchLogRequestDto;
import com.shelfy.api.collection.dto.WatchLogResponseDto;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WatchLogService {

  private final UserMediaRepository userMediaRepository;
  private final WatchLogRepository watchLogRepository;
  private final RichTextContentValidator richTextContentValidator;
  private final UserActivityService userActivityService;

  @Transactional(readOnly = true)
  public List<WatchLogResponseDto> list(UUID userId, UUID itemId) {
    getOwnedItem(userId, itemId);
    return watchLogRepository.findByUserMediaIdOrderByOccurredAtDescCreatedAtDesc(itemId).stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public WatchLogResponseDto create(UUID userId, UUID itemId, UpsertWatchLogRequestDto request) {
    UserMediaEntity item = getOwnedItem(userId, itemId);
    WatchLogEntity entry =
        new WatchLogEntity(item, request.occurredAt(), request.isRewatch(), "manual");
    entry.setName(blankToNull(request.name()));
    entry.setRating(request.rating());
    entry.setReview(validatedReview(request.review()));
    entry.setContainsSpoilers(request.containsSpoilers());
    WatchLogEntity saved = watchLogRepository.save(entry);

    applyHistory(item, saved.isRepeat());
    userMediaRepository.save(item);

    return toResponse(saved);
  }

  @Transactional
  public void logCompletion(UserMediaEntity item, LocalDate completedOn) {
    if (!watchLogRepository.findByUserMediaIdOrderByOccurredAtAsc(item.getId()).isEmpty()) {
      return;
    }
    WatchLogEntity entry =
        new WatchLogEntity(
            item,
            completedOn != null ? completedOn : LocalDate.now(ZoneOffset.UTC),
            false,
            "status");
    entry.setRating(item.getRating());
    entry.setReview(item.getNote());
    entry.setContainsSpoilers(item.isContainsSpoilers());
    watchLogRepository.save(entry);
  }

  @Transactional
  public void syncLatest(UserMediaEntity item, boolean rating, boolean review) {
    List<WatchLogEntity> entries =
        watchLogRepository.findByUserMediaIdOrderByOccurredAtDescCreatedAtDesc(item.getId());
    if (entries.isEmpty() || (!rating && !review)) {
      return;
    }
    WatchLogEntity latest = entries.getFirst();
    if (rating) {
      latest.setRating(item.getRating());
    }
    if (review) {
      latest.setReview(item.getNote());
      latest.setContainsSpoilers(item.isContainsSpoilers());
    }
    watchLogRepository.save(latest);
  }

  @Transactional
  public WatchLogResponseDto update(
      UUID userId, UUID itemId, UUID logId, UpsertWatchLogRequestDto request) {
    UserMediaEntity item = getOwnedItem(userId, itemId);
    WatchLogEntity entry = getEntry(itemId, logId);
    entry.setOccurredAt(request.occurredAt());
    entry.setRepeat(request.isRewatch());
    entry.setName(blankToNull(request.name()));
    entry.setRating(request.rating());
    entry.setReview(validatedReview(request.review()));
    entry.setContainsSpoilers(request.containsSpoilers());
    WatchLogEntity saved = watchLogRepository.save(entry);

    applyHistory(item, false);
    userMediaRepository.save(item);

    return toResponse(saved);
  }

  @Transactional
  public void delete(UUID userId, UUID itemId, UUID logId) {
    UserMediaEntity item = getOwnedItem(userId, itemId);
    WatchLogEntity entry = getEntry(itemId, logId);
    watchLogRepository.delete(entry);

    applyHistory(item, false);
    userMediaRepository.save(item);
  }

  private void applyHistory(UserMediaEntity item, boolean rewatch) {
    List<WatchLogEntity> entries =
        watchLogRepository.findByUserMediaIdOrderByOccurredAtDescCreatedAtDesc(item.getId());
    if (entries.isEmpty()) {
      return;
    }
    item.setStatus(UserMediaStatus.DONE);
    Integer ratingBefore = item.getRating();
    Map<String, Object> noteBefore = item.getNote();
    entries.stream()
        .map(WatchLogEntity::getRating)
        .filter(Objects::nonNull)
        .findFirst()
        .ifPresent(item::setRating);
    entries.stream()
        .filter(entry -> entry.getReview() != null)
        .findFirst()
        .ifPresent(
            entry -> {
              item.setNote(entry.getReview());
              item.setContainsSpoilers(entry.isContainsSpoilers());
              if (item.getReviewedAt() == null) {
                item.setReviewedAt(Instant.now());
              }
            });
    if (!Objects.equals(ratingBefore, item.getRating())) {
      userActivityService.record(
          item,
          ActivityType.RATED,
          Map.of(
              "rating",
              item.getRating(),
              "previous",
              ratingBefore == null ? "" : ratingBefore,
              "rewatch",
              rewatch));
    }
    if (!Objects.equals(noteBefore, item.getNote())) {
      userActivityService.record(
          item, ActivityType.REVIEWED, Map.of("action", noteBefore == null ? "added" : "updated"));
    }
  }

  private UserMediaEntity getOwnedItem(UUID userId, UUID itemId) {
    return userMediaRepository
        .findByIdAndUserId(itemId, userId)
        .orElseThrow(
            () ->
                new ResourceNotFoundException(
                    ErrorCode.COLLECTION_ITEM_NOT_FOUND, "Collection item not found"));
  }

  private WatchLogEntity getEntry(UUID itemId, UUID logId) {
    return watchLogRepository
        .findByIdAndUserMediaId(logId, itemId)
        .orElseThrow(
            () -> new ResourceNotFoundException(ErrorCode.WATCH_LOG_NOT_FOUND, "Entry not found"));
  }

  private WatchLogResponseDto toResponse(WatchLogEntity entry) {
    return new WatchLogResponseDto(
        entry.getId(),
        entry.getOccurredAt(),
        entry.isRepeat(),
        entry.getName(),
        entry.getRating(),
        entry.getReview(),
        entry.isContainsSpoilers(),
        entry.getSource(),
        entry.getCreatedAt());
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value.strip();
  }

  private Map<String, Object> validatedReview(Map<String, Object> review) {
    richTextContentValidator.validate(review);
    return review;
  }
}
