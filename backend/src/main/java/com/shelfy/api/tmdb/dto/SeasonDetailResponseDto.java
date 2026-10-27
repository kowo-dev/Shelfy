package com.shelfy.api.tmdb.dto;

import java.util.List;

public record SeasonDetailResponseDto(
    int seasonNumber,
    String name,
    String overview,
    String posterPath,
    List<EpisodeResponseDto> episodes) {}
