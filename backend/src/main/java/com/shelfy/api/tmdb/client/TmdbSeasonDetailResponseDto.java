package com.shelfy.api.tmdb.client;

import java.util.List;

public record TmdbSeasonDetailResponseDto(
    int seasonNumber,
    String name,
    String overview,
    String posterPath,
    List<TmdbEpisodeResponseDto> episodes) {}
