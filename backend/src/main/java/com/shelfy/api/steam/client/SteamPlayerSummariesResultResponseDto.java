package com.shelfy.api.steam.client;

import java.util.List;

public record SteamPlayerSummariesResultResponseDto(List<SteamPlayerSummaryResponseDto> players) {}
