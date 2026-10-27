package com.shelfy.api.tmdb.client;

public record TmdbPersonResponseDto(
    long id,
    String name,
    String biography,
    String profilePath,
    String birthday,
    String deathday,
    String placeOfBirth,
    TmdbCombinedCreditsResponseDto combinedCredits) {}
