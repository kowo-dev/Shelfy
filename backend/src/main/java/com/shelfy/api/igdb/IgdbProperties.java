package com.shelfy.api.igdb;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.igdb")
public record IgdbProperties(
    String url, String authUrl, String imageBaseUrl, String clientId, String clientSecret) {}
