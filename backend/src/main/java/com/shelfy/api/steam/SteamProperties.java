package com.shelfy.api.steam;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.steam")
public record SteamProperties(
    String apiBaseUrl,
    String communityBaseUrl,
    String authorizeUrl,
    String apiKey,
    String callbackUrl,
    String frontendRedirectUri) {}
