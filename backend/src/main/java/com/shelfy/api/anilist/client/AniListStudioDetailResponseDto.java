package com.shelfy.api.anilist.client;

public record AniListStudioDetailResponseDto(
    long id, String name, AniListMediaConnectionResponseDto media) {}
