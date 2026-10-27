package com.shelfy.api.anilist.dto;

import java.util.List;

public record BrowseMediaResponseDto(List<AniListEntityMediaResponseDto> items, boolean hasMore) {}
