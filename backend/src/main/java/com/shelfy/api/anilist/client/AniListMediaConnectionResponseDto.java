package com.shelfy.api.anilist.client;

import java.util.List;

public record AniListMediaConnectionResponseDto(
    List<AniListMediaEdgeResponseDto> edges, AniListPageInfoResponseDto pageInfo) {}
