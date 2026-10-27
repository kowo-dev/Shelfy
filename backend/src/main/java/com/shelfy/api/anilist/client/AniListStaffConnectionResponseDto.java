package com.shelfy.api.anilist.client;

import java.util.List;

public record AniListStaffConnectionResponseDto(List<AniListStaffEdgeResponseDto> edges) {}
