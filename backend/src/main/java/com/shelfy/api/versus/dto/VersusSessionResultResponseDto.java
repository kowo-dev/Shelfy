package com.shelfy.api.versus.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record VersusSessionResultResponseDto(
    UUID sessionId,
    UUID poolId,
    String poolName,
    VersusPlayerDto player,
    Instant completedAt,
    int entryCount,
    List<VersusPodiumEntryDto> podium,
    int agreement,
    int communitySessionCount,
    List<VersusPodiumEntryDto> gaps) {}
