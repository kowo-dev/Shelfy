package com.shelfy.api.versus;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.shelfy.api.auth.AvatarStorageProperties;
import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.collection.CanonicalWorkEntity;
import com.shelfy.api.collection.MediaEntity;
import com.shelfy.api.collection.MediaType;
import com.shelfy.api.common.exception.BadRequestException;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.versus.dto.StartVersusSessionResponseDto;
import com.shelfy.api.versus.dto.SubmitPickRequestDto;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class VersusSessionServiceTest {

  private final VersusPoolService poolService = mock(VersusPoolService.class);
  private final VersusSessionRepository sessionRepository = mock(VersusSessionRepository.class);
  private final VersusMatchRepository matchRepository = mock(VersusMatchRepository.class);
  private final VersusSessionService service =
      new VersusSessionService(
          poolService,
          sessionRepository,
          matchRepository,
          new VersusEntryMapper(new AvatarStorageProperties("/tmp", "http://api", 1)),
          mock(NotificationService.class));
  private final UUID userId = UUID.randomUUID();

  @Test
  void startSession_whenFewerThanFourItems_rejects() {
    VersusPoolEntity pool = poolWithItems(3);
    when(poolService.findVisibleEntity(userId, poolId(pool))).thenReturn(pool);

    BadRequestException exception =
        assertThrows(BadRequestException.class, () -> service.startSession(userId, poolId(pool)));
    assertEquals(ErrorCode.VERSUS_POOL_TOO_SMALL, exception.getCode());
  }

  @Test
  void startSession_whenExactlyFourItems_generatesTwoRoundsNoByes() {
    VersusPoolEntity pool = poolWithItems(4);
    when(poolService.findVisibleEntity(userId, poolId(pool))).thenReturn(pool);
    stubSaveReturnsArgument();

    StartVersusSessionResponseDto response = service.startSession(userId, poolId(pool));

    assertEquals(4, response.bracketSize());
    assertEquals(2, response.roundsTotal());
    assertEquals(1, response.currentRound());
    assertNotNull(response.currentMatch());
    assertFalse(response.currentMatch().isDecided());
    assertNotNull(response.currentMatch().entryA());
    assertNotNull(response.currentMatch().entryB());
  }

  @Test
  void startSession_whenEightItems_powerOfTwo_noByes() {
    VersusPoolEntity pool = poolWithItems(8);
    when(poolService.findVisibleEntity(userId, poolId(pool))).thenReturn(pool);
    VersusSessionEntity captured = captureSavedSession(pool);

    assertEquals(8, captured.getBracketSize());
    assertEquals(3, captured.getRoundsTotal());
    List<VersusMatchEntity> round1 = matchesForRound(captured, 1);
    assertEquals(4, round1.size());
    assertTrue(round1.stream().noneMatch(VersusMatchEntity::isBye));
    assertTrue(round1.stream().noneMatch(VersusMatchEntity::isDecided));
  }

  @Test
  void startSession_whenFiveItems_createsThreeByesAndOneRealMatch() {
    assertBracketWithByes(5, 8, 3);
  }

  @Test
  void startSession_whenSixItems_createsTwoByesAndTwoRealMatches() {
    assertBracketWithByes(6, 8, 2);
  }

  @Test
  void startSession_whenSevenItems_createsOneByeAndThreeRealMatches() {
    assertBracketWithByes(7, 8, 1);
  }

  private void assertBracketWithByes(int itemCount, int expectedBracketSize, int expectedByes) {
    VersusPoolEntity pool = poolWithItems(itemCount);
    when(poolService.findVisibleEntity(userId, poolId(pool))).thenReturn(pool);
    VersusSessionEntity captured = captureSavedSession(pool);

    assertEquals(expectedBracketSize, captured.getBracketSize());
    List<VersusMatchEntity> round1 = matchesForRound(captured, 1);
    assertEquals(expectedBracketSize / 2, round1.size());

    long byeCount = round1.stream().filter(VersusMatchEntity::isBye).count();
    assertEquals(expectedByes, byeCount);
    round1.stream()
        .filter(VersusMatchEntity::isBye)
        .forEach(
            match -> {
              assertNull(match.getEntryB());
              assertNotNull(match.getEntryA());
              assertTrue(match.isDecided());
              assertEquals(match.getEntryA().getId(), match.getWinnerEntry().getId());
            });
    round1.stream()
        .filter(m -> !m.isBye())
        .forEach(
            match -> {
              assertNotNull(match.getEntryA());
              assertNotNull(match.getEntryB());
              assertFalse(match.isDecided());
            });

    assertTrue(round1.stream().anyMatch(m -> !m.isBye()));
  }

  @Test
  void fullPlaythrough_fourItemBracket_reachesAWinner() {
    VersusPoolEntity pool = poolWithItems(4);
    when(poolService.findVisibleEntity(userId, poolId(pool))).thenReturn(pool);
    VersusSessionEntity session = captureSavedSession(pool);
    UUID sessionId = UUID.randomUUID();
    ReflectionTestUtils.setField(session, "id", sessionId);

    when(sessionRepository.findByIdAndUserIdForUpdate(sessionId, userId))
        .thenReturn(Optional.of(session));

    List<VersusMatchEntity> round1 = matchesForRound(session, 1);
    assertEquals(2, round1.size());

    VersusPoolItemEntity round1Winner0 = round1.get(0).getEntryA();
    StartVersusSessionResponseDto afterFirstPick =
        service.submitPick(userId, sessionId, new SubmitPickRequestDto(round1Winner0.getId()));
    assertEquals(VersusSessionStatus.IN_PROGRESS, afterFirstPick.status());
    assertEquals(1, afterFirstPick.currentRound());
    assertNotNull(afterFirstPick.currentMatch());

    VersusPoolItemEntity round1Winner1 = round1.get(1).getEntryA();
    StartVersusSessionResponseDto afterSecondPick =
        service.submitPick(userId, sessionId, new SubmitPickRequestDto(round1Winner1.getId()));
    assertEquals(VersusSessionStatus.IN_PROGRESS, afterSecondPick.status());
    assertEquals(2, afterSecondPick.currentRound());
    assertNotNull(afterSecondPick.currentMatch());
    assertEquals(round1Winner0.getId(), afterSecondPick.currentMatch().entryA().id());
    assertEquals(round1Winner1.getId(), afterSecondPick.currentMatch().entryB().id());

    StartVersusSessionResponseDto finalResponse =
        service.submitPick(userId, sessionId, new SubmitPickRequestDto(round1Winner0.getId()));
    assertEquals(VersusSessionStatus.COMPLETED, finalResponse.status());
    assertNotNull(finalResponse.winnerEntry());
    assertEquals(round1Winner0.getId(), finalResponse.winnerEntry().id());
    assertNull(finalResponse.currentMatch());
  }

  private VersusSessionEntity captureSavedSession(VersusPoolEntity pool) {
    Map<Boolean, VersusSessionEntity> box = new java.util.HashMap<>();
    when(sessionRepository.save(any(VersusSessionEntity.class)))
        .thenAnswer(
            invocation -> {
              VersusSessionEntity arg = invocation.getArgument(0);
              box.put(true, arg);
              return arg;
            });
    service.startSession(userId, poolId(pool));
    return box.get(true);
  }

  private void stubSaveReturnsArgument() {
    when(sessionRepository.save(any(VersusSessionEntity.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));
  }

  private List<VersusMatchEntity> matchesForRound(VersusSessionEntity session, int round) {
    List<VersusMatchEntity> result = new ArrayList<>();
    for (VersusMatchEntity match : session.getMatches()) {
      if (match.getRound() == round) {
        result.add(match);
      }
    }
    return result;
  }

  private VersusPoolEntity poolWithItems(int itemCount) {
    VersusPoolEntity pool =
        new VersusPoolEntity(UUID.randomUUID(), "Pool", null, CollectionVisibility.PUBLIC);
    ReflectionTestUtils.setField(pool, "id", UUID.randomUUID());
    for (int i = 0; i < itemCount; i++) {
      ReflectionTestUtils.setField(pool.appendItem(media("media-" + i)), "id", UUID.randomUUID());
    }
    return pool;
  }

  private UUID poolId(VersusPoolEntity pool) {
    return pool.getId();
  }

  private MediaEntity media(String externalId) {
    MediaEntity media =
        new MediaEntity(
            externalId,
            "tmdb",
            MediaType.MOVIE,
            new CanonicalWorkEntity(MediaType.MOVIE),
            "Title " + externalId,
            null,
            Map.of(),
            false);
    media.setId(UUID.randomUUID());
    return media;
  }
}
