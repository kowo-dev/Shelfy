package com.shelfy.api.search.dto;

import java.util.List;

public record SearchResponseDto(
    List<SearchResultResponseDto> results,
    int page,
    boolean hasMore,
    List<String> unavailableProviders) {}
