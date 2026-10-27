package com.shelfy.api.anilist.client;

public record AniListStaffDetailResponseDto(
    long id,
    AniListCharacterNameResponseDto name,
    String description,
    AniListCharacterImageResponseDto image,
    AniListMediaConnectionResponseDto staffMedia) {}
