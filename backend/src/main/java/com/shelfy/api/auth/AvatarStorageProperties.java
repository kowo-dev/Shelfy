package com.shelfy.api.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.avatar")
public record AvatarStorageProperties(String directory, String publicBaseUrl, long maxSizeBytes) {}
