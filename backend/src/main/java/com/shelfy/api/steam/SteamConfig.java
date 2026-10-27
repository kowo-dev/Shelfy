package com.shelfy.api.steam;

import com.shelfy.api.common.http.ExternalApiRequestFactory;
import java.util.concurrent.Executor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.client.RestClient;

@Configuration
public class SteamConfig {

  @Bean
  public RestClient steamApiRestClient(SteamProperties properties) {
    return RestClient.builder()
        .baseUrl(properties.apiBaseUrl())
        .requestFactory(ExternalApiRequestFactory.create())
        .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
        .build();
  }

  @Bean
  public RestClient steamCommunityRestClient(SteamProperties properties) {
    return RestClient.builder()
        .baseUrl(properties.communityBaseUrl())
        .requestFactory(ExternalApiRequestFactory.create())
        .defaultHeader(HttpHeaders.ACCEPT, MediaType.TEXT_PLAIN_VALUE)
        .build();
  }

  @Bean
  public Executor steamImportExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(1);
    executor.setMaxPoolSize(1);
    executor.setQueueCapacity(50);
    executor.setThreadNamePrefix("steam-import-");
    executor.initialize();
    return executor;
  }
}
