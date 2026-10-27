package com.shelfy.api.versus.dto;

public record VersusPodiumEntryDto(
    VersusEntryResponseDto entry, int place, Integer communityRank) {}
