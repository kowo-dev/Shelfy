package com.shelfy.api.anilist.client;

import java.util.List;

public record AniListPageResponseDto(
    List<AniListMediaResponseDto> media, AniListPageInfoResponseDto pageInfo) {}
