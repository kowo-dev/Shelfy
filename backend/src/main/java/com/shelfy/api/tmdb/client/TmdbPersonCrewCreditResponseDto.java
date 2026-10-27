package com.shelfy.api.tmdb.client;

public record TmdbPersonCrewCreditResponseDto(
    long id,
    String title,
    String name,
    String mediaType,
    String posterPath,
    String releaseDate,
    String firstAirDate,
    String job,
    Double popularity,
    Double voteAverage,
    boolean adult) {}
