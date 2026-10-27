package com.shelfy.api.igdb.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

public record GameDetailResponseDto(
    long id,
    String name,
    String summary,
    String storyline,
    LocalDate releaseDate,
    String coverImageId,
    List<String> screenshotImageIds,
    List<String> artworkImageIds,
    List<FacetRefDto> genres,
    List<FacetRefDto> platforms,
    List<FacetRefDto> themes,
    List<CompanyRefDto> developers,
    List<CompanyRefDto> publishers,
    List<FacetRefDto> gameModes,
    double rating,
    int ratingCount,
    Long franchiseId,
    String franchiseName,
    List<GameSummaryResponseDto> dlcs,
    boolean isAdult,
    Set<String> steamAppIds) {}
