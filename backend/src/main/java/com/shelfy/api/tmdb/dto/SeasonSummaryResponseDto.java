package com.shelfy.api.tmdb.dto;

import java.time.LocalDate;

public record SeasonSummaryResponseDto(
    int seasonNumber, String name, int episodeCount, String posterPath, LocalDate airDate) {}
