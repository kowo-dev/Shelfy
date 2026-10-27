package com.shelfy.api.versus.dto;

import java.util.List;
import java.util.UUID;

public record VersusPoolResultsResponseDto(
    UUID poolId, int completedSessionCount, List<VersusMediaRankingEntryDto> ranking) {}
