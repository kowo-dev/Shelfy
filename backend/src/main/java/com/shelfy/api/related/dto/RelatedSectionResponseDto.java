package com.shelfy.api.related.dto;

import com.shelfy.api.search.dto.SearchResultResponseDto;
import java.util.List;

public record RelatedSectionResponseDto(
    String kind,
    String label,
    RelatedEntityDto entity,
    List<SearchResultResponseDto> items,
    boolean hasMore) {}
