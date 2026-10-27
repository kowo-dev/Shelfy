package com.shelfy.api.anilist.client;

import java.util.List;

public record AniListCharacterEdgeResponseDto(
    List<AniListStaffResponseDto> voiceActors, String role, AniListCharacterResponseDto node) {}
