package com.shelfy.api.tmdb.dto;

import java.time.LocalDate;
import java.util.List;

public record MovieSummaryResponseDto(
    long id,
    String title,
    String originalTitle,
    String overview,
    String posterPath,
    String backdropPath,
    LocalDate releaseDate,
    List<Integer> genreIds,
    double voteAverage,
    int voteCount,
    boolean isAdult) {}
