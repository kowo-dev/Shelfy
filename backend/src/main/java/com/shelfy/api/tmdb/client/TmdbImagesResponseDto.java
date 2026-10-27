package com.shelfy.api.tmdb.client;

import java.util.List;

public record TmdbImagesResponseDto(
    List<TmdbImageResponseDto> backdrops,
    List<TmdbImageResponseDto> logos,
    List<TmdbImageResponseDto> posters) {}
