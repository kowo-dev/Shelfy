package com.shelfy.api.search;

import com.shelfy.api.search.dto.SearchResultResponseDto;
import java.util.List;

record CachedSearchPage(List<SearchResultResponseDto> results, boolean hasMore) {}
