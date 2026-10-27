package com.shelfy.api.collection.dto;

import java.time.Instant;
import java.time.LocalDate;

public record NextEpisodeResponseDto(
    CollectionItemResponseDto item,
    Integer season,
    int episode,
    String title,
    LocalDate airDate,
    Instant airingAt,
    String stillPath) {}
