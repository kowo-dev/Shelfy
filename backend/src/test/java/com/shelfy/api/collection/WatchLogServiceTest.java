package com.shelfy.api.collection;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.shelfy.api.activity.ActivityType;
import com.shelfy.api.activity.UserActivityService;
import com.shelfy.api.collection.dto.UpsertWatchLogRequestDto;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

class WatchLogServiceTest {

  private final UserMediaRepository userMediaRepository = mock(UserMediaRepository.class);
  private final WatchLogRepository watchLogRepository = mock(WatchLogRepository.class);
  private final UserActivityService userActivityService = mock(UserActivityService.class);
  private final WatchLogService watchLogService =
      new WatchLogService(
          userMediaRepository,
          watchLogRepository,
          new RichTextContentValidator(),
          userActivityService);

  @Test
  void logCompletion_logsTodayWhenNothingIsLoggedYet() {
    UserMediaEntity item = doneMovie();
    when(watchLogRepository.findByUserMediaIdOrderByOccurredAtAsc(item.getId()))
        .thenReturn(List.of());

    watchLogService.logCompletion(item, null);

    ArgumentCaptor<WatchLogEntity> saved = ArgumentCaptor.forClass(WatchLogEntity.class);
    verify(watchLogRepository).save(saved.capture());
    assertEquals(LocalDate.now(ZoneOffset.UTC), saved.getValue().getOccurredAt());
    assertEquals("status", saved.getValue().getSource());
  }

  @Test
  void logCompletion_usesTheDayTheClientSent() {
    UserMediaEntity item = doneMovie();
    when(watchLogRepository.findByUserMediaIdOrderByOccurredAtAsc(item.getId()))
        .thenReturn(List.of());

    watchLogService.logCompletion(item, LocalDate.of(2026, 10, 23));

    ArgumentCaptor<WatchLogEntity> saved = ArgumentCaptor.forClass(WatchLogEntity.class);
    verify(watchLogRepository).save(saved.capture());
    assertEquals(LocalDate.of(2026, 10, 23), saved.getValue().getOccurredAt());
  }

  @Test
  void logCompletion_keepsAnExistingHistory() {
    UserMediaEntity item = doneMovie();
    when(watchLogRepository.findByUserMediaIdOrderByOccurredAtAsc(item.getId()))
        .thenReturn(List.of(new WatchLogEntity(item, LocalDate.of(2024, 1, 1), false, "manual")));

    watchLogService.logCompletion(item, null);

    verify(watchLogRepository, never()).save(any());
  }

  @Test
  void logCompletion_snapshotsTheCurrentRatingAndReview() {
    UserMediaEntity item = doneMovie();
    item.setRating(70);
    item.setNote(Map.of("type", "doc"));
    when(watchLogRepository.findByUserMediaIdOrderByOccurredAtAsc(item.getId()))
        .thenReturn(List.of());

    watchLogService.logCompletion(item, null);

    ArgumentCaptor<WatchLogEntity> saved = ArgumentCaptor.forClass(WatchLogEntity.class);
    verify(watchLogRepository).save(saved.capture());
    assertEquals(70, saved.getValue().getRating());
    assertEquals(Map.of("type", "doc"), saved.getValue().getReview());
  }

  @Test
  void create_marksTheTitleDoneAndTakesTheLatestRatingAndReview() {
    UserMediaEntity item = doneMovie();
    item.setStatus(UserMediaStatus.ONGOING);
    item.setRating(80);
    item.setNote(Map.of("type", "doc", "v", 1));
    Map<String, Object> newer = Map.of("type", "doc", "v", 2);
    WatchLogEntity latest = new WatchLogEntity(item, LocalDate.of(2026, 10, 3), true, "manual");
    latest.setRating(40);
    latest.setReview(newer);
    latest.setContainsSpoilers(true);
    WatchLogEntity older = new WatchLogEntity(item, LocalDate.of(2025, 1, 1), false, "manual");
    older.setRating(80);
    when(userMediaRepository.findByIdAndUserId(item.getId(), item.getUserId()))
        .thenReturn(Optional.of(item));
    when(watchLogRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    when(watchLogRepository.findByUserMediaIdOrderByOccurredAtDescCreatedAtDesc(item.getId()))
        .thenReturn(List.of(latest, older));

    watchLogService.create(
        item.getUserId(),
        item.getId(),
        new UpsertWatchLogRequestDto(LocalDate.of(2026, 10, 3), true, null, 40, newer, true));

    assertEquals(UserMediaStatus.DONE, item.getStatus());
    assertEquals(40, item.getRating());
    assertEquals(newer, item.getNote());
    assertTrue(item.isContainsSpoilers());
    verify(userActivityService)
        .record(item, ActivityType.RATED, Map.of("rating", 40, "previous", 80, "rewatch", true));
  }

  @Test
  void create_keepsTheTitleRatingWhenNoViewingIsRated() {
    UserMediaEntity item = doneMovie();
    item.setRating(80);
    when(userMediaRepository.findByIdAndUserId(item.getId(), item.getUserId()))
        .thenReturn(Optional.of(item));
    when(watchLogRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    when(watchLogRepository.findByUserMediaIdOrderByOccurredAtDescCreatedAtDesc(item.getId()))
        .thenReturn(List.of(new WatchLogEntity(item, LocalDate.of(2026, 10, 3), true, "manual")));

    watchLogService.create(
        item.getUserId(),
        item.getId(),
        new UpsertWatchLogRequestDto(LocalDate.of(2026, 10, 3), true, null, null, null, false));

    assertEquals(80, item.getRating());
  }

  @Test
  void syncLatest_writesTheTitleValuesOntoTheLatestViewing() {
    UserMediaEntity item = doneMovie();
    item.setRating(90);
    item.setNote(Map.of("type", "doc"));
    WatchLogEntity latest = new WatchLogEntity(item, LocalDate.of(2026, 10, 3), true, "manual");
    latest.setRating(50);
    when(watchLogRepository.findByUserMediaIdOrderByOccurredAtDescCreatedAtDesc(item.getId()))
        .thenReturn(List.of(latest));

    watchLogService.syncLatest(item, true, false);

    assertEquals(90, latest.getRating());
    assertNull(latest.getReview());
    verify(watchLogRepository).save(latest);
  }

  private static UserMediaEntity doneMovie() {
    MediaEntity media =
        new MediaEntity(
            "1",
            "tmdb",
            MediaType.MOVIE,
            new CanonicalWorkEntity(MediaType.MOVIE),
            "Film",
            null,
            Map.of(),
            false);
    UserMediaEntity item =
        new UserMediaEntity(UUID.randomUUID(), media, UserMediaStatus.DONE, null, Map.of());
    ReflectionTestUtils.setField(item, "id", UUID.randomUUID());
    return item;
  }
}
