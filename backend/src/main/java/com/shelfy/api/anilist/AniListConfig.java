package com.shelfy.api.anilist;

import com.shelfy.api.common.http.ExternalApiRequestFactory;
import com.shelfy.api.common.http.ProviderRateLimitInterceptor;
import com.shelfy.api.common.http.ProviderRateLimiter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

@Configuration
public class AniListConfig {

  private static final int BURST = 3;

  @Bean
  public RestClient anilistRestClient(AniListProperties properties) {
    return RestClient.builder()
        .baseUrl(properties.url())
        .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
        .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
        .requestFactory(ExternalApiRequestFactory.create())
        .requestInterceptor(
            new ProviderRateLimitInterceptor(
                new ProviderRateLimiter("AniList", properties.requestsPerMinute(), BURST)))
        .build();
  }
}
