package com.shelfy.api.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app.email-verification")
public record EmailVerificationProperties(
    long expirationMinutes, String verifyUrl, @DefaultValue("true") boolean required) {}
