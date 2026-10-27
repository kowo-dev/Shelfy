package com.shelfy.api.anilist.dto;

import java.time.LocalDate;
import java.util.List;

public record AnimeDetailResponseDto(
    long id,
    String title,
    String summary,
    LocalDate releaseDate,
    LocalDate endDate,
    String coverImageUrl,
    String bannerImageUrl,
    List<String> genres,
    List<String> tags,
    List<StudioRefDto> studios,
    String format,
    String source,
    String season,
    Integer seasonYear,
    String countryOfOrigin,
    double rating,
    int popularity,
    Integer episodes,
    Integer airedEpisodes,
    String status,
    List<CharacterResponseDto> characters,
    String trailerUrl,
    List<StaffCreditDto> creators) {}
