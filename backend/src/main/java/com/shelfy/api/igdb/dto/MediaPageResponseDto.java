package com.shelfy.api.igdb.dto;

import java.util.List;

public record MediaPageResponseDto<T>(List<T> content, boolean hasMore) {}
