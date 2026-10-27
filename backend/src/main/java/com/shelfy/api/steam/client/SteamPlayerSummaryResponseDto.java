package com.shelfy.api.steam.client;

import com.fasterxml.jackson.annotation.JsonProperty;

public record SteamPlayerSummaryResponseDto(
    @JsonProperty("personaname") String personaName,
    @JsonProperty("avatarfull") String avatarFull) {}
