package com.shelfy.api.tmdb.dto;

import java.time.LocalDate;

public record EpisodeResponseDto(
    int episodeNumber,
    int seasonNumber,
    String name,
    String overview,
    LocalDate airDate,
    String stillPath,
    Integer runtime,
    Double voteAverage,
    Integer voteCount) {}
