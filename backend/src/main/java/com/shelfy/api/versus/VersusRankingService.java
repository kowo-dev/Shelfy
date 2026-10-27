package com.shelfy.api.versus;

import com.shelfy.api.versus.dto.VersusMediaRankingEntryDto;
import com.shelfy.api.versus.dto.VersusPoolResultsResponseDto;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class VersusRankingService {
  private final VersusSessionRepository sessionRepository;
  private final VersusMatchRepository matchRepository;
  private final VersusEntryMapper entryMapper;

  @Transactional(readOnly = true)
  public VersusPoolResultsResponseDto computeResults(UUID poolId, boolean adultContentAllowed) {
    List<VersusSessionEntity> latestCompletedPerUser = latestCompletedSessionPerUser(poolId);
    if (latestCompletedPerUser.isEmpty()) {
      return new VersusPoolResultsResponseDto(poolId, 0, List.of());
    }

    List<UUID> sessionIds =
        latestCompletedPerUser.stream().map(VersusSessionEntity::getId).toList();
    Map<UUID, Integer> roundsTotalBySession = new HashMap<>();
    for (VersusSessionEntity session : latestCompletedPerUser) {
      roundsTotalBySession.put(session.getId(), session.getRoundsTotal());
    }

    List<VersusMatchEntity> decidedMatches =
        matchRepository.findDecidedNonByeMatchesBySessionIds(sessionIds);

    Map<UUID, Map<UUID, Integer>> maxRoundBySessionAndMedia = new HashMap<>();
    Map<UUID, Map<UUID, Boolean>> wonAtMaxRoundBySessionAndMedia = new HashMap<>();
    Map<UUID, VersusPoolItemEntity> entryById = new HashMap<>();

    List<VersusMatchEntity> byRoundAsc =
        decidedMatches.stream()
            .sorted(Comparator.comparingInt(VersusMatchEntity::getRound))
            .toList();

    Accumulator accumulator = new Accumulator();

    for (VersusMatchEntity match : byRoundAsc) {
      UUID sessionId = match.getSession().getId();
      VersusPoolItemEntity mediaA = match.getEntryA();
      VersusPoolItemEntity mediaB = match.getEntryB();
      VersusPoolItemEntity winner = match.getWinnerEntry();
      entryById.put(mediaA.getId(), mediaA);
      entryById.put(mediaB.getId(), mediaB);

      Map<UUID, Integer> maxRound =
          maxRoundBySessionAndMedia.computeIfAbsent(sessionId, k -> new HashMap<>());
      Map<UUID, Boolean> wonAtMaxRound =
          wonAtMaxRoundBySessionAndMedia.computeIfAbsent(sessionId, k -> new HashMap<>());

      maxRound.put(mediaA.getId(), match.getRound());
      wonAtMaxRound.put(mediaA.getId(), mediaA.getId().equals(winner.getId()));
      maxRound.put(mediaB.getId(), match.getRound());
      wonAtMaxRound.put(mediaB.getId(), mediaB.getId().equals(winner.getId()));

      accumulator.recordMatch(mediaA.getId(), mediaB.getId(), winner.getId());
    }

    for (Map.Entry<UUID, Map<UUID, Integer>> sessionEntry : maxRoundBySessionAndMedia.entrySet()) {
      UUID sessionId = sessionEntry.getKey();
      int roundsTotal = roundsTotalBySession.get(sessionId);
      Map<UUID, Boolean> wonAtMaxRound = wonAtMaxRoundBySessionAndMedia.get(sessionId);
      for (Map.Entry<UUID, Integer> mediaEntry : sessionEntry.getValue().entrySet()) {
        UUID mediaId = mediaEntry.getKey();
        int maxRound = mediaEntry.getValue();
        boolean wonThatMatch = wonAtMaxRound.get(mediaId);
        int points = (wonThatMatch && maxRound == roundsTotal) ? roundsTotal + 1 : maxRound - 1;
        accumulator.recordAppearance(mediaId, points);
      }
    }

    List<VersusMediaRankingEntryDto> ranking =
        accumulator.entries().stream()
            .map(
                entry ->
                    new VersusMediaRankingEntryDto(
                        entryMapper
                            .toDto(entryById.get(entry.mediaId()))
                            .maskedIfAdult(adultContentAllowed),
                        entry.appearances(),
                        entry.wins(),
                        entry.avgPoints(),
                        entry.winRate()))
            .sorted(
                Comparator.comparingDouble(VersusMediaRankingEntryDto::avgPoints)
                    .reversed()
                    .thenComparing(
                        Comparator.comparingDouble(VersusMediaRankingEntryDto::winRate).reversed())
                    .thenComparing(
                        Comparator.comparingInt(VersusMediaRankingEntryDto::appearances)
                            .reversed()))
            .toList();

    return new VersusPoolResultsResponseDto(poolId, latestCompletedPerUser.size(), ranking);
  }

  private List<VersusSessionEntity> latestCompletedSessionPerUser(UUID poolId) {
    List<VersusSessionEntity> ordered =
        sessionRepository.findCompletedByPoolOrderByUserAndCompletedAtDesc(poolId);
    Set<UUID> seenUsers = new HashSet<>();
    List<VersusSessionEntity> latest = new ArrayList<>();
    for (VersusSessionEntity session : ordered) {
      if (seenUsers.add(session.getUserId())) {
        latest.add(session);
      }
    }
    return latest;
  }

  private static final class Accumulator {
    private final Map<UUID, Integer> matchesPlayed = new LinkedHashMap<>();
    private final Map<UUID, Integer> wins = new LinkedHashMap<>();
    private final Map<UUID, Integer> totalPoints = new LinkedHashMap<>();
    private final Map<UUID, Integer> appearances = new LinkedHashMap<>();

    void recordMatch(UUID mediaAId, UUID mediaBId, UUID winnerId) {
      matchesPlayed.merge(mediaAId, 1, Integer::sum);
      matchesPlayed.merge(mediaBId, 1, Integer::sum);
      wins.merge(winnerId, 1, Integer::sum);
    }

    void recordAppearance(UUID mediaId, int points) {
      totalPoints.merge(mediaId, points, Integer::sum);
      appearances.merge(mediaId, 1, Integer::sum);
    }

    List<Entry> entries() {
      List<Entry> result = new ArrayList<>();
      for (UUID mediaId : appearances.keySet()) {
        int played = matchesPlayed.getOrDefault(mediaId, 0);
        int won = wins.getOrDefault(mediaId, 0);
        int appearanceCount = appearances.get(mediaId);
        double avgPoints = totalPoints.get(mediaId) / (double) appearanceCount;
        double winRate = played == 0 ? 0.0 : won / (double) played;
        result.add(new Entry(mediaId, appearanceCount, won, avgPoints, winRate));
      }
      return result;
    }

    record Entry(UUID mediaId, int appearances, int wins, double avgPoints, double winRate) {}
  }
}
