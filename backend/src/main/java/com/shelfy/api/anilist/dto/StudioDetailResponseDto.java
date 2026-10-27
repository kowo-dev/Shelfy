package com.shelfy.api.anilist.dto;

import java.util.List;

public record StudioDetailResponseDto(
    long id, String name, List<AniListEntityMediaResponseDto> media) {}
