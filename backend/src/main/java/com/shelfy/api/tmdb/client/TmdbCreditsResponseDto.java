package com.shelfy.api.tmdb.client;

import java.util.List;

public record TmdbCreditsResponseDto(
    List<TmdbCastMemberResponseDto> cast, List<TmdbCrewMemberResponseDto> crew) {}
