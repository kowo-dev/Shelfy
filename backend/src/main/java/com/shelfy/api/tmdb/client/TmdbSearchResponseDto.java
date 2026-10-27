package com.shelfy.api.tmdb.client;

import java.util.List;

public record TmdbSearchResponseDto<T>(
    List<T> results, int page, int totalPages, int totalResults) {}
