package com.shelfy.api.tmdb.client;

import java.util.List;

public record TmdbGenreListResponseDto(List<TmdbGenreResponseDto> genres) {}
