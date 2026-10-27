package com.shelfy.api.collection.dto;

import java.util.List;

public record ShelfCompareResponseDto(
    long commonCount, Double ratingGapAverage, List<BothLovedItemDto> bothLoved) {}
