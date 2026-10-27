package com.shelfy.api.related.dto;

import com.shelfy.api.search.dto.SearchResultResponseDto;
import java.util.List;

public record SimilarMediaResponseDto(
    List<SearchResultResponseDto> results, int page, boolean hasMore) {}
