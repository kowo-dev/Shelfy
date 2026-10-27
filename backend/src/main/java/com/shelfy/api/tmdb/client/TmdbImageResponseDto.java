package com.shelfy.api.tmdb.client;

public record TmdbImageResponseDto(
    double aspectRatio,
    int height,
    String filePath,
    String iso6391,
    double voteAverage,
    int voteCount,
    int width) {}
