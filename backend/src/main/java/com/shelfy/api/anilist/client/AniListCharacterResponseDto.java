package com.shelfy.api.anilist.client;

public record AniListCharacterResponseDto(
    long id, AniListCharacterNameResponseDto name, AniListCharacterImageResponseDto image) {}
