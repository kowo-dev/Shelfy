package com.shelfy.api.legal;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.legal")
public record LegalProperties(
    String controllerName,
    String contactEmail,
    String jurisdiction,
    String hostingProviderName,
    String hostingProviderAddress) {}
