package com.shelfy.api.igdb.client;

public record IgdbExternalGameRefResponseDto(
    long id, String name, Integer gameType, Long firstReleaseDate, IgdbImageResponseDto cover) {}
