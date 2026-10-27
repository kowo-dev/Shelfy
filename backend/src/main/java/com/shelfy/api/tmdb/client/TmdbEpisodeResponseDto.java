package com.shelfy.api.tmdb.client;

public record TmdbEpisodeResponseDto(
    int episodeNumber,
    int seasonNumber,
    String name,
    String overview,
    String airDate,
    String stillPath,
    Integer runtime,
    Double voteAverage,
    Integer voteCount) {}
