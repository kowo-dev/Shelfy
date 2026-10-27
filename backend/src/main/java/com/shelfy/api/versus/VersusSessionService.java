package com.shelfy.api.versus;

import com.shelfy.api.common.exception.BadRequestException;
import com.shelfy.api.common.exception.ConflictException;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.notifications.NotificationType;
import com.shelfy.api.versus.dto.StartVersusSessionResponseDto;
import com.shelfy.api.versus.dto.SubmitPickRequestDto;
import com.shelfy.api.versus.dto.VersusEntryResponseDto;
import com.shelfy.api.versus.dto.VersusMatchResponseDto;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class VersusSessionService {
  private static final int MIN_POOL_SIZE = 4;

  private final VersusPoolService poolService;
  private final VersusSessionRepository sessionRepository;
  private final VersusMatchRepository matchRepository;
  private final VersusEntryMapper entryMapper;
  private final NotificationService notificationService;

  @Transactional
  public StartVersusSessionResponseDto startSession(UUID userId, UUID poolId) {
    VersusPoolEntity pool = poolService.findVisibleEntity(userId, poolId);
    List<VersusPoolItemEntity> items = List.copyOf(pool.getItems());
    if (items.size() < MIN_POOL_SIZE) {
      throw new BadRequestException(
          ErrorCode.VERSUS_POOL_TOO_SMALL,
          "A pool needs at least " + MIN_POOL_SIZE + " items to start a game");
    }

    int n = items.size();
    int bracketSize = nextPowerOfTwo(n);
    int roundsTotal = log2(bracketSize);

    VersusSessionEntity session = new VersusSessionEntity(pool, userId, bracketSize, roundsTotal);
    generateFirstRound(session, items, bracketSize);
    session = sessionRepository.save(session);

    return toResponse(session);
  }

  @Transactional(readOnly = true)
  public StartVersusSessionResponseDto getSession(UUID userId, UUID sessionId) {
    VersusSessionEntity session = getOwnedSession(userId, sessionId);
    return toResponse(session);
  }

  @Transactional
  public StartVersusSessionResponseDto submitPick(
      UUID userId, UUID sessionId, SubmitPickRequestDto request) {
    VersusSessionEntity session = getOwnedSessionForUpdate(userId, sessionId);
    if (session.getStatus() != VersusSessionStatus.IN_PROGRESS) {
      throw new ConflictException(
          ErrorCode.VERSUS_SESSION_ALREADY_COMPLETED, "This session is already completed");
    }

    VersusMatchEntity currentMatch =
        findCurrentMatch(session)
            .orElseThrow(
                () ->
                    new ResourceNotFoundException(
                        ErrorCode.VERSUS_MATCH_NOT_FOUND, "No active match"));

    UUID winnerId = request.winnerEntryId();
    VersusPoolItemEntity winner;
    if (currentMatch.getEntryA() != null && currentMatch.getEntryA().getId().equals(winnerId)) {
      winner = currentMatch.getEntryA();
    } else if (currentMatch.getEntryB() != null
        && currentMatch.getEntryB().getId().equals(winnerId)) {
      winner = currentMatch.getEntryB();
    } else {
      throw new BadRequestException(
          ErrorCode.VERSUS_INVALID_PICK, "winnerEntryId does not match either entry in this match");
    }
    currentMatch.decide(winner);

    List<VersusMatchEntity> roundMatches = matchesForRound(session, session.getCurrentRound());
    boolean roundComplete = roundMatches.stream().allMatch(VersusMatchEntity::isDecided);

    if (!roundComplete) {
      sessionRepository.save(session);
      return toResponse(session);
    }

    if (session.getCurrentRound() == session.getRoundsTotal()) {
      VersusPoolItemEntity champion = roundMatches.get(0).getWinnerEntry();
      session.complete(champion);
      sessionRepository.save(session);
      notificationService.create(
          session.getPool().getUserId(),
          userId,
          NotificationType.VERSUS_PLAYED,
          "VERSUS_POOL",
          session.getPool().getId(),
          Map.of());
      return toResponse(session);
    }

    List<VersusPoolItemEntity> winners =
        roundMatches.stream()
            .sorted((a, b) -> Integer.compare(a.getSlotIndex(), b.getSlotIndex()))
            .map(VersusMatchEntity::getWinnerEntry)
            .toList();
    int nextRound = session.getCurrentRound() + 1;
    for (int i = 0; i < winners.size() / 2; i++) {
      session.addMatch(nextRound, i, winners.get(2 * i), winners.get(2 * i + 1));
    }
    session.advanceToRound(nextRound);
    sessionRepository.save(session);
    return toResponse(session);
  }

  @Transactional
  public StartVersusSessionResponseDto undo(UUID userId, UUID sessionId) {
    VersusSessionEntity session = getOwnedSessionForUpdate(userId, sessionId);
    VersusMatchEntity last =
        session.getMatches().stream()
            .filter(match -> match.isDecided() && !match.isBye())
            .max(
                Comparator.comparingInt(VersusMatchEntity::getRound)
                    .thenComparing(VersusMatchEntity::getDecidedAt))
            .orElseThrow(
                () ->
                    new ConflictException(
                        ErrorCode.VERSUS_NOTHING_TO_UNDO, "There is no pick to undo"));
    if (session.getStatus() == VersusSessionStatus.COMPLETED) {
      session.reopen();
    } else if (last.getRound() < session.getCurrentRound()) {
      session.dropRound(session.getCurrentRound());
      session.advanceToRound(last.getRound());
    }
    last.undo();
    sessionRepository.save(session);
    return toResponse(session);
  }

  @Transactional(readOnly = true)
  public Optional<StartVersusSessionResponseDto> getCurrentSession(UUID userId, UUID poolId) {
    return sessionRepository
        .findFirstByPoolIdAndUserIdAndStatusOrderByCreatedAtDesc(
            poolId, userId, VersusSessionStatus.IN_PROGRESS)
        .map(this::toResponse);
  }

  @Transactional(readOnly = true)
  public List<VersusMatchResponseDto> getBracket(UUID userId, UUID sessionId) {
    VersusSessionEntity session = getOwnedSession(userId, sessionId);
    return matchRepository.findBySessionIdOrderByRoundAscSlotIndexAsc(session.getId()).stream()
        .map(this::toMatchResponse)
        .toList();
  }

  private VersusSessionEntity getOwnedSession(UUID userId, UUID sessionId) {
    return sessionRepository
        .findByIdAndUserId(sessionId, userId)
        .orElseThrow(
            () ->
                new ResourceNotFoundException(
                    ErrorCode.VERSUS_SESSION_NOT_FOUND, "Session not found"));
  }

  private VersusSessionEntity getOwnedSessionForUpdate(UUID userId, UUID sessionId) {
    return sessionRepository
        .findByIdAndUserIdForUpdate(sessionId, userId)
        .orElseThrow(
            () ->
                new ResourceNotFoundException(
                    ErrorCode.VERSUS_SESSION_NOT_FOUND, "Session not found"));
  }

  private void generateFirstRound(
      VersusSessionEntity session, List<VersusPoolItemEntity> items, int bracketSize) {
    List<VersusPoolItemEntity> shuffled = new ArrayList<>(items);
    Collections.shuffle(shuffled);
    int matchCount = bracketSize / 2;
    int byeCount = bracketSize - items.size();

    List<Boolean> matchIsBye = new ArrayList<>(Collections.nCopies(matchCount, Boolean.FALSE));
    for (int i = 0; i < byeCount; i++) {
      matchIsBye.set(i, Boolean.TRUE);
    }
    Collections.shuffle(matchIsBye);

    Deque<VersusPoolItemEntity> pool = new ArrayDeque<>(shuffled);
    for (int slot = 0; slot < matchCount; slot++) {
      VersusPoolItemEntity entryA = pool.poll();
      VersusPoolItemEntity entryB = matchIsBye.get(slot) ? null : pool.poll();
      session.addMatch(1, slot, entryA, entryB);
    }
  }

  private Optional<VersusMatchEntity> findCurrentMatch(VersusSessionEntity session) {
    return matchesForRound(session, session.getCurrentRound()).stream()
        .filter(m -> !m.isDecided())
        .min((a, b) -> Integer.compare(a.getSlotIndex(), b.getSlotIndex()));
  }

  private List<VersusMatchEntity> matchesForRound(VersusSessionEntity session, int round) {
    return session.getMatches().stream().filter(m -> m.getRound() == round).toList();
  }

  private StartVersusSessionResponseDto toResponse(VersusSessionEntity session) {
    VersusMatchResponseDto currentMatch =
        session.getStatus() == VersusSessionStatus.IN_PROGRESS
            ? findCurrentMatch(session).map(this::toMatchResponse).orElse(null)
            : null;
    return new StartVersusSessionResponseDto(
        session.getId(),
        session.getPool().getId(),
        session.getStatus(),
        session.getBracketSize(),
        session.getRoundsTotal(),
        session.getCurrentRound(),
        currentMatch,
        session.getWinnerEntry() == null ? null : toEntry(session, session.getWinnerEntry()));
  }

  private VersusMatchResponseDto toMatchResponse(VersusMatchEntity match) {
    return new VersusMatchResponseDto(
        match.getId(),
        match.getRound(),
        match.getSlotIndex(),
        match.getEntryA() == null ? null : toEntry(match.getSession(), match.getEntryA()),
        match.getEntryB() == null ? null : toEntry(match.getSession(), match.getEntryB()),
        match.getWinnerEntry() == null ? null : match.getWinnerEntry().getId(),
        match.isDecided());
  }

  private VersusEntryResponseDto toEntry(VersusSessionEntity session, VersusPoolItemEntity entry) {
    return entryMapper
        .toDto(entry)
        .maskedIfAdult(poolService.allowsAdultContent(session.getUserId()));
  }

  static int nextPowerOfTwo(int n) {
    int power = 1;
    while (power < n) {
      power <<= 1;
    }
    return power;
  }

  static int log2(int powerOfTwo) {
    int result = 0;
    int value = powerOfTwo;
    while (value > 1) {
      value >>= 1;
      result++;
    }
    return result;
  }
}
