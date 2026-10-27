package com.shelfy.api.versus.dto;

import java.time.Instant;
import java.util.UUID;

public record VersusFollowedSessionResponseDto(
    UUID sessionId, VersusPlayerDto player, VersusEntryResponseDto winner, Instant completedAt) {}
