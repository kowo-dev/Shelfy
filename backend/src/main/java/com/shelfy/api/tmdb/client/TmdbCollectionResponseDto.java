package com.shelfy.api.tmdb.client;

import java.util.List;

public record TmdbCollectionResponseDto(long id, String name, List<TmdbMovieResponseDto> parts) {}
