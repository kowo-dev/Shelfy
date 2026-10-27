package com.shelfy.api.anilist.client;

import java.util.List;

public record AniListMediaResponseDto(
    long id,
    String type,
    AniListTitleResponseDto title,
    String description,
    AniListCoverImageResponseDto coverImage,
    String bannerImage,
    List<String> genres,
    List<AniListTagResponseDto> tags,
    AniListStudioConnectionResponseDto studios,
    AniListStaffConnectionResponseDto staff,
    AniListCharacterConnectionResponseDto characters,
    AniListTrailerResponseDto trailer,
    String format,
    String source,
    String season,
    Integer seasonYear,
    String countryOfOrigin,
    Double averageScore,
    Integer popularity,
    AniListDateResponseDto startDate,
    AniListDateResponseDto endDate,
    Integer episodes,
    Integer chapters,
    Integer volumes,
    String status,
    Boolean isAdult,
    AniListRelationsResponseDto relations,
    AniListNextAiringResponseDto nextAiringEpisode) {}
