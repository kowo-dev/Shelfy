package com.shelfy.api.anilist.client;

public record AniListCharacterDetailResponseDto(
    long id,
    AniListCharacterNameResponseDto name,
    String description,
    AniListCharacterImageResponseDto image,
    AniListMediaConnectionResponseDto media) {}
