package com.shelfy.api.tmdb.dto;

import java.time.LocalDate;

public record PersonCreditResponseDto(
    long mediaId,
    String mediaType,
    String title,
    String posterPath,
    LocalDate releaseDate,
    String character,
    String job,
    double popularity,
    double voteAverage) {}
