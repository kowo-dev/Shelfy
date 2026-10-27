package com.shelfy.api.igdb.client;

public record TwitchTokenResponseDto(String accessToken, Long expiresIn, String tokenType) {}
