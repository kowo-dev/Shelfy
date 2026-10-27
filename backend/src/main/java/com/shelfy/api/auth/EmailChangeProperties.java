package com.shelfy.api.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.email-change")
public record EmailChangeProperties(long expirationMinutes, String confirmUrl) {}
