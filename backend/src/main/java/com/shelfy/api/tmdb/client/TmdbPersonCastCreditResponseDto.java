package com.shelfy.api.tmdb.client;

public record TmdbPersonCastCreditResponseDto(
    long id,
    String title,
    String name,
    String mediaType,
    String posterPath,
    String releaseDate,
    String firstAirDate,
    String character,
    Double popularity,
    Double voteAverage,
    boolean adult) {}
