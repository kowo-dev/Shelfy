package com.shelfy.api.anilist.dto;

import java.time.LocalDate;
import java.util.List;

public record MangaDetailResponseDto(
    long id,
    String title,
    String summary,
    LocalDate releaseDate,
    LocalDate endDate,
    String coverImageUrl,
    String bannerImageUrl,
    List<String> genres,
    List<String> tags,
    String format,
    String source,
    String countryOfOrigin,
    double rating,
    int popularity,
    Integer chapters,
    Integer volumes,
    String status,
    List<CharacterResponseDto> characters,
    String trailerUrl,
    List<StaffCreditDto> creators) {}
