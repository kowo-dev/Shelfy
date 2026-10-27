package com.shelfy.api.tmdb.client;

public record TmdbCastMemberResponseDto(
    long id, String name, String character, String profilePath, int order) {}
