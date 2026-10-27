package com.shelfy.api.versus.dto;

import com.shelfy.api.versus.VersusSessionStatus;
import java.util.UUID;

public record StartVersusSessionResponseDto(
    UUID sessionId,
    UUID poolId,
    VersusSessionStatus status,
    int bracketSize,
    int roundsTotal,
    int currentRound,
    VersusMatchResponseDto currentMatch,
    VersusEntryResponseDto winnerEntry) {}
