package com.shelfy.api.anilist.dto;

import java.time.LocalDate;
import java.util.List;

public record MangaSummaryResponseDto(
    long id,
    String title,
    String summary,
    LocalDate releaseDate,
    String coverImageUrl,
    List<String> genres,
    double rating,
    int popularity,
    Integer chapters,
    String status,
    String bannerImageUrl) {}
