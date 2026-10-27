package com.shelfy.api.collection.dto;

import java.util.Map;

public record CollectionStatsResponseDto(
    Map<String, Long> countsByMediaType,
    long total,
    Map<String, Long> countsByStatus,
    Map<String, Map<String, Long>> countsByMediaTypeAndStatus,
    Double averageRating) {}
