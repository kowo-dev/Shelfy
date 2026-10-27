package com.shelfy.api.versus;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.shelfy.api.auth.AvatarStorageProperties;
import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.collection.CanonicalWorkEntity;
import com.shelfy.api.collection.MediaEntity;
import com.shelfy.api.collection.MediaType;
import com.shelfy.api.versus.dto.VersusMediaRankingEntryDto;
import com.shelfy.api.versus.dto.VersusPoolResultsResponseDto;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class VersusRankingServiceTest {

  private final VersusSessionRepository sessionRepository = mock(VersusSessionRepository.class);
  private final VersusMatchRepository matchRepository = mock(VersusMatchRepository.class);
  private final VersusRankingService service =
      new VersusRankingService(
          sessionRepository,
          matchRepository,
          new VersusEntryMapper(new AvatarStorageProperties("/tmp", "http://api", 1)));

  @Test
  void computeResults_whenNoCompletedSessions_returnsEmptyRanking() {
    UUID poolId = UUID.randomUUID();
    when(sessionRepository.findCompletedByPoolOrderByUserAndCompletedAtDesc(poolId))
        .thenReturn(List.of());

    VersusPoolResultsResponseDto results = service.computeResults(poolId, true);

    assertEquals(0, results.completedSessionCount());
    assertTrue(results.ranking().isEmpty());
  }

  @Test
  void computeResults_fourItemBracket_computesPointsAndWinRateFromDecidedMatches() {
    UUID poolId = UUID.randomUUID();
    VersusPoolEntity pool =
        new VersusPoolEntity(UUID.randomUUID(), "Pool", null, CollectionVisibility.PUBLIC);
    ReflectionTestUtils.setField(pool, "id", poolId);

    VersusPoolItemEntity mediaA = entry(pool, "A");
    VersusPoolItemEntity mediaB = entry(pool, "B");
    VersusPoolItemEntity mediaC = entry(pool, "C");
    VersusPoolItemEntity mediaD = entry(pool, "D");

    VersusSessionEntity session = new VersusSessionEntity(pool, UUID.randomUUID(), 4, 2);
    ReflectionTestUtils.setField(session, "id", UUID.randomUUID());

    VersusMatchEntity r1m0 = session.addMatch(1, 0, mediaA, mediaB);
    r1m0.decide(mediaA);
    VersusMatchEntity r1m1 = session.addMatch(1, 1, mediaC, mediaD);
    r1m1.decide(mediaC);
    VersusMatchEntity r2m0 = session.addMatch(2, 0, mediaA, mediaC);
    r2m0.decide(mediaA);

    when(sessionRepository.findCompletedByPoolOrderByUserAndCompletedAtDesc(poolId))
        .thenReturn(List.of(session));
    when(matchRepository.findDecidedNonByeMatchesBySessionIds(List.of(session.getId())))
        .thenReturn(List.of(r1m0, r1m1, r2m0));

    VersusPoolResultsResponseDto results = service.computeResults(poolId, true);

    assertEquals(1, results.completedSessionCount());
    Map<UUID, VersusMediaRankingEntryDto> byMediaId =
        results.ranking().stream()
            .collect(java.util.stream.Collectors.toMap(e -> e.entry().id(), e -> e));

    VersusMediaRankingEntryDto championEntry = byMediaId.get(mediaA.getId());
    assertEquals(3.0, championEntry.avgPoints());
    assertEquals(1.0, championEntry.winRate());
    assertEquals(2, championEntry.wins());

    VersusMediaRankingEntryDto runnerUpEntry = byMediaId.get(mediaC.getId());
    assertEquals(1.0, runnerUpEntry.avgPoints());
    assertEquals(0.5, runnerUpEntry.winRate());

    assertEquals(0.0, byMediaId.get(mediaB.getId()).avgPoints());
    assertEquals(0.0, byMediaId.get(mediaD.getId()).avgPoints());

    assertEquals(mediaA.getId(), results.ranking().get(0).entry().id());
    assertEquals(mediaC.getId(), results.ranking().get(1).entry().id());
  }

  @Test
  void computeResults_keepsOnlyLatestCompletedSessionPerUser() {
    UUID poolId = UUID.randomUUID();
    VersusPoolEntity pool =
        new VersusPoolEntity(UUID.randomUUID(), "Pool", null, CollectionVisibility.PUBLIC);
    ReflectionTestUtils.setField(pool, "id", poolId);
    UUID userId = UUID.randomUUID();

    VersusPoolItemEntity mediaA = entry(pool, "A");
    VersusPoolItemEntity mediaB = entry(pool, "B");
    VersusPoolItemEntity mediaC = entry(pool, "C");
    VersusPoolItemEntity mediaD = entry(pool, "D");

    VersusSessionEntity olderSession = new VersusSessionEntity(pool, userId, 4, 2);
    ReflectionTestUtils.setField(olderSession, "id", UUID.randomUUID());

    when(sessionRepository.findCompletedByPoolOrderByUserAndCompletedAtDesc(poolId))
        .thenReturn(List.of(olderSession));
    VersusMatchEntity onlyMatch = olderSession.addMatch(1, 0, mediaA, mediaB);
    onlyMatch.decide(mediaA);
    VersusMatchEntity secondMatch = olderSession.addMatch(1, 1, mediaC, mediaD);
    secondMatch.decide(mediaC);
    when(matchRepository.findDecidedNonByeMatchesBySessionIds(List.of(olderSession.getId())))
        .thenReturn(List.of(onlyMatch, secondMatch));

    VersusPoolResultsResponseDto results = service.computeResults(poolId, true);
    assertEquals(1, results.completedSessionCount());
  }

  private VersusPoolItemEntity entry(VersusPoolEntity pool, String externalId) {
    VersusPoolItemEntity entry = pool.appendItem(media(externalId));
    ReflectionTestUtils.setField(entry, "id", UUID.randomUUID());
    return entry;
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
