package com.shelfy.api.tmdb.dto;

import java.util.List;

public record TmdbSearchResponseDto<T>(
    List<T> results, int page, int totalPages, int totalResults) {}
