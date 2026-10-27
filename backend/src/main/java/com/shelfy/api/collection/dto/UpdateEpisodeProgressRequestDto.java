package com.shelfy.api.collection.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record UpdateEpisodeProgressRequestDto(
    @Min(0) int season,
    @NotEmpty @Size(max = 500) List<@Min(1) Integer> episodes,
    boolean isWatched) {}
