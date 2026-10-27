package com.shelfy.api.anilist.dto;

import java.util.List;

public record AniListSearchResultsDto(
    List<AnimeSummaryResponseDto> anime,
    List<MangaSummaryResponseDto> manga,
    List<MangaSummaryResponseDto> webtoons) {}
