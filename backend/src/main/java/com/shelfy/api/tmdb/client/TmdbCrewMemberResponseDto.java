package com.shelfy.api.tmdb.client;

public record TmdbCrewMemberResponseDto(
    long id, String name, String job, String department, String profilePath) {}
