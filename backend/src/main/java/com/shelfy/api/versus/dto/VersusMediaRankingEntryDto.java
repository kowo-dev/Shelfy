package com.shelfy.api.versus.dto;

public record VersusMediaRankingEntryDto(
    VersusEntryResponseDto entry, int appearances, int wins, double avgPoints, double winRate) {}
