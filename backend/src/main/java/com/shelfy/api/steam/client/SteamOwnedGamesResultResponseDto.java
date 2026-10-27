package com.shelfy.api.steam.client;

import java.util.List;

public record SteamOwnedGamesResultResponseDto(List<SteamOwnedGameResponseDto> games) {}
