package com.shelfy.api.tmdb.client;

import java.util.Map;

public record TmdbWatchProviderResponseDto(
    int providerId, String providerName, String logoPath, Map<String, Integer> displayPriorities) {}
