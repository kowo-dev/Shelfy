package com.shelfy.api.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app.registration")
public record RegistrationProperties(@DefaultValue("true") boolean open) {}
