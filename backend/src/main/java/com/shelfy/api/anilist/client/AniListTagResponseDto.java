package com.shelfy.api.anilist.client;

public record AniListTagResponseDto(
    long id, String name, boolean isGeneralSpoiler, boolean isMediaSpoiler) {}
