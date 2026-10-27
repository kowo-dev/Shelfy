package com.shelfy.api.igdb.dto;

import java.util.List;

public record FranchiseDetailResponseDto(
    long id, String name, List<GameSummaryResponseDto> games) {}
