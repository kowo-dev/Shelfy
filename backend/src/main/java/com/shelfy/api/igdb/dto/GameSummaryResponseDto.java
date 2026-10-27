package com.shelfy.api.igdb.dto;

import java.time.LocalDate;
import java.util.List;

public record GameSummaryResponseDto(
    long id,
    String name,
    String summary,
    LocalDate releaseDate,
    String coverImageId,
    List<String> screenshotImageIds,
    List<String> artworkImageIds,
    List<String> genres,
    List<String> platforms,
    double rating,
    int ratingCount,
    boolean isAdult) {}
