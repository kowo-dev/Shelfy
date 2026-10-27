package com.shelfy.api.tmdb.client;

import java.util.List;

public record TmdbVideosResponseDto(List<TmdbVideoResponseDto> results) {}
