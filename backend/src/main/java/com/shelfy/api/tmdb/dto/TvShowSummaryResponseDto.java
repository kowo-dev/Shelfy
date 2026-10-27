package com.shelfy.api.tmdb.dto;

import java.time.LocalDate;
import java.util.List;

public record TvShowSummaryResponseDto(
    long id,
    String name,
    String originalName,
    String overview,
    String posterPath,
    String backdropPath,
    LocalDate firstAirDate,
    List<Integer> genreIds,
    double voteAverage,
    int voteCount,
    boolean isAdult) {}
