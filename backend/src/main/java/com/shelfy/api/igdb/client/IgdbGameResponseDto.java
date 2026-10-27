package com.shelfy.api.igdb.client;

import java.util.List;

public record IgdbGameResponseDto(
    long id,
    String name,
    String summary,
    String storyline,
    IgdbImageResponseDto cover,
    List<IgdbImageResponseDto> screenshots,
    List<IgdbImageResponseDto> artworks,
    Long firstReleaseDate,
    List<IgdbGenreResponseDto> genres,
    List<IgdbPlatformResponseDto> platforms,
    List<IgdbThemeResponseDto> themes,
    List<IgdbInvolvedCompanyResponseDto> involvedCompanies,
    List<IgdbGameModeResponseDto> gameModes,
    Double totalRating,
    Integer totalRatingCount,
    Integer hypes,
    IgdbFranchiseResponseDto franchise,
    List<Long> franchises,
    Integer category,
    List<IgdbExternalGameResponseDto> externalGames,
    List<IgdbGameResponseDto> similarGames) {}
