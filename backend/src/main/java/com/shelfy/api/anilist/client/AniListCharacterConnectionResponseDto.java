package com.shelfy.api.anilist.client;

import java.util.List;

public record AniListCharacterConnectionResponseDto(List<AniListCharacterEdgeResponseDto> edges) {}
