package com.shelfy.api.tmdb.client;

public record TmdbSeasonSummaryResponseDto(
    int seasonNumber, String name, Integer episodeCount, String posterPath, String airDate) {}
