package com.shelfy.api.tmdb;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.tmdb")
public record TmdbProperties(String url, String accessToken, String imageBaseUrl) {}
