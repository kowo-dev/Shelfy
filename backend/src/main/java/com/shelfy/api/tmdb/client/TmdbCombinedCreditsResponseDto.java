package com.shelfy.api.tmdb.client;

import java.util.List;

public record TmdbCombinedCreditsResponseDto(
    List<TmdbPersonCastCreditResponseDto> cast, List<TmdbPersonCrewCreditResponseDto> crew) {}
