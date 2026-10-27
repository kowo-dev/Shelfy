package com.shelfy.api.igdb.client;

public record IgdbExternalGameResponseDto(
    String uid, IgdbExternalGameRefResponseDto game, Integer externalGameSource) {}
