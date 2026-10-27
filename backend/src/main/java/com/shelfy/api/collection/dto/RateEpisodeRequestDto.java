package com.shelfy.api.collection.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record RateEpisodeRequestDto(
    @Min(0) int season, @Min(1) int episode, @Min(0) @Max(10) Integer rating) {}
