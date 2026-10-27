package com.shelfy.api.anilist.dto;

import java.time.LocalDate;
import java.util.List;

public record AnimeSummaryResponseDto(
    long id,
    String title,
    String summary,
    LocalDate releaseDate,
    String coverImageUrl,
    List<String> genres,
    double rating,
    int popularity,
    Integer episodes,
    String status,
    String bannerImageUrl) {}
