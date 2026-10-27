package com.shelfy.api.anilist;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app.anilist")
public record AniListProperties(String url, @DefaultValue("30") int requestsPerMinute) {}
