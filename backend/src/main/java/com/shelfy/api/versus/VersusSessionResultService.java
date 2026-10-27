package com.shelfy.api.versus;

import com.shelfy.api.auth.AvatarStorageService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.common.exception.ConflictException;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.follows.FollowRepository;
import com.shelfy.api.versus.dto.VersusEntryResponseDto;
import com.shelfy.api.versus.dto.VersusFollowedSessionResponseDto;
import com.shelfy.api.versus.dto.VersusMediaRankingEntryDto;
import com.shelfy.api.versus.dto.VersusPlayerDto;
import com.shelfy.api.versus.dto.VersusPodiumEntryDto;
import com.shelfy.api.versus.dto.VersusPoolResultsResponseDto;
import com.shelfy.api.versus.dto.VersusSessionResultResponseDto;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class VersusSessionResultService {
  private static final int GAP_COUNT = 3;
  private static final int MIN_GAP = 2;

  private final VersusSessionRepository sessionRepository;
  private final VersusPoolService poolService;
  private final VersusRankingService rankingService;
  private final VersusEntryMapper entryMapper;
  private final UserRepository userRepository;
  private final AvatarStorageService avatarStorageService;
  private final FollowRepository followRepository;

  @Transactional(readOnly = true)
  public VersusSessionResultResponseDto getResult(UUID viewerId, UUID sessionId) {
    VersusSessionEntity session =
        sessionRepository
            .findById(sessionId)
            .orElseThrow(
                () ->
                    new ResourceNotFoundException(
                        ErrorCode.VERSUS_SESSION_NOT_FOUND, "Session not found"));
    VersusPoolEntity pool = poolService.findVisibleEntity(viewerId, session.getPool().getId());
    if (session.getStatus() != VersusSessionStatus.COMPLETED) {
      throw new ConflictException(
          ErrorCode.VERSUS_SESSION_IN_PROGRESS, "This game is not finished yet");
    }
    boolean adultContentAllowed = poolService.allowsAdultContent(viewerId);

    Map<UUID, Integer> places = places(session);
    Map<UUID, VersusPoolItemEntity> entries = entries(session);
    VersusPoolResultsResponseDto results =
        rankingService.computeResults(pool.getId(), adultContentAllowed);
    List<VersusMediaRankingEntryDto> ranking = results.ranking();
    Map<UUID, Integer> communityRank = new HashMap<>();
    for (int i = 0; i < ranking.size(); i++) {
      communityRank.put(ranking.get(i).entry().id(), i + 1);
    }

    List<VersusPodiumEntryDto> podium =
        places.entrySet().stream()
            .filter(entry -> entry.getValue() <= 3)
            .sorted(Map.Entry.comparingByValue())
            .map(
                entry ->
                    podiumEntry(
                        entries.get(entry.getKey()),
                        entry.getValue(),
                        communityRank,
                        adultContentAllowed))
            .toList();

    Set<UUID> communityTop = new HashSet<>();
    for (int i = 0; i < Math.min(podium.size(), ranking.size()); i++) {
      communityTop.add(ranking.get(i).entry().id());
    }
    long shared =
        podium.stream().filter(entry -> communityTop.contains(entry.entry().id())).count();
    int agreement = podium.isEmpty() ? 0 : (int) Math.round(100.0 * shared / podium.size());

    List<VersusPodiumEntryDto> gaps =
        places.entrySet().stream()
            .filter(entry -> communityRank.containsKey(entry.getKey()))
            .filter(
                entry -> Math.abs(communityRank.get(entry.getKey()) - entry.getValue()) >= MIN_GAP)
            .sorted(
                Comparator.comparingInt(
                        (Map.Entry<UUID, Integer> entry) ->
                            Math.abs(communityRank.get(entry.getKey()) - entry.getValue()))
                    .reversed())
            .limit(GAP_COUNT)
            .map(
                entry ->
                    podiumEntry(
                        entries.get(entry.getKey()),
                        entry.getValue(),
                        communityRank,
                        adultContentAllowed))
            .toList();

    return new VersusSessionResultResponseDto(
        session.getId(),
        pool.getId(),
        pool.getName(),
        player(session.getUserId()),
        session.getCompletedAt(),
        entries.size(),
        podium,
        agreement,
        results.completedSessionCount(),
        gaps);
  }

  @Transactional(readOnly = true)
  public List<VersusFollowedSessionResponseDto> listFollowedSessions(UUID viewerId, UUID poolId) {
    VersusPoolEntity pool = poolService.findVisibleEntity(viewerId, poolId);
    List<UUID> followed = followRepository.findPublicFollowedIds(viewerId);
    if (followed.isEmpty()) {
      return List.of();
    }
    boolean adultContentAllowed = poolService.allowsAdultContent(viewerId);
    Set<UUID> seen = new HashSet<>();
    List<VersusFollowedSessionResponseDto> result = new ArrayList<>();
    for (VersusSessionEntity session :
        sessionRepository.findCompletedByPoolAndUsers(pool.getId(), followed)) {
      if (!seen.add(session.getUserId())) {
        continue;
      }
      result.add(
          new VersusFollowedSessionResponseDto(
              session.getId(),
              player(session.getUserId()),
              session.getWinnerEntry() == null
                  ? null
                  : entryMapper.toDto(session.getWinnerEntry()).maskedIfAdult(adultContentAllowed),
              session.getCompletedAt()));
    }
    result.sort(Comparator.comparing(VersusFollowedSessionResponseDto::completedAt).reversed());
    return result;
  }

  static Map<UUID, Integer> places(VersusSessionEntity session) {
    Map<UUID, Integer> places = new HashMap<>();
    int roundsTotal = session.getRoundsTotal();
    for (VersusMatchEntity match : session.getMatches()) {
      if (match.isBye() || match.getWinnerEntry() == null) {
        continue;
      }
      VersusPoolItemEntity loser =
          match.getWinnerEntry().getId().equals(match.getEntryA().getId())
              ? match.getEntryB()
              : match.getEntryA();
      places.put(loser.getId(), (1 << (roundsTotal - match.getRound())) + 1);
    }
    if (session.getWinnerEntry() != null) {
      places.put(session.getWinnerEntry().getId(), 1);
    }
    return places;
  }

  private static Map<UUID, VersusPoolItemEntity> entries(VersusSessionEntity session) {
    Map<UUID, VersusPoolItemEntity> entries = new HashMap<>();
    for (VersusMatchEntity match : session.getMatches()) {
      if (match.getEntryA() != null) {
        entries.put(match.getEntryA().getId(), match.getEntryA());
      }
      if (match.getEntryB() != null) {
        entries.put(match.getEntryB().getId(), match.getEntryB());
      }
    }
    return entries;
  }

  private VersusPodiumEntryDto podiumEntry(
      VersusPoolItemEntity item,
      int place,
      Map<UUID, Integer> communityRank,
      boolean adultContentAllowed) {
    VersusEntryResponseDto entry = entryMapper.toDto(item).maskedIfAdult(adultContentAllowed);
    return new VersusPodiumEntryDto(entry, place, communityRank.get(item.getId()));
  }

  private VersusPlayerDto player(UUID userId) {
    return userRepository
        .findById(userId)
        .map(
            (UserEntity user) ->
                new VersusPlayerDto(
                    user.getUsername(),
                    user.getDisplayName(),
                    avatarStorageService.urlFor(user.getAvatarFilename())))
        .orElse(new VersusPlayerDto(null, null, null));
  }
}
