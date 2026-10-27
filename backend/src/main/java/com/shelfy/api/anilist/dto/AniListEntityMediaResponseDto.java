package com.shelfy.api.anilist.dto;

public record AniListEntityMediaResponseDto(
    long id, String mediaType, String title, String coverImageUrl, double rating) {}
