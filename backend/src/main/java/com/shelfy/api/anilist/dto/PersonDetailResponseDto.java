package com.shelfy.api.anilist.dto;

import java.util.List;

public record PersonDetailResponseDto(
    long id,
    String name,
    String description,
    String imageUrl,
    List<AniListEntityMediaResponseDto> media) {}
