package com.shelfy.api.search.dto;

import com.shelfy.api.collection.MediaType;
import java.util.List;

public record ExploreResponseDto(
    List<SearchResultResponseDto> results,
    int page,
    boolean hasMore,
    List<String> unavailableProviders,
    List<MediaType> skippedTypes) {}
