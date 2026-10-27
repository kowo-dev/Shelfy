package com.shelfy.api.igdb;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.shelfy.api.common.http.ExternalApiRequestFactory;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.web.client.RestClient;

@Configuration
public class IgdbConfig {

  @Bean
  public RestClient igdbRestClient(IgdbProperties properties) {
    return RestClient.builder()
        .baseUrl(properties.url())
        .messageConverters(this::useSnakeCaseJson)
        .requestFactory(ExternalApiRequestFactory.create())
        .build();
  }

  @Bean
  public RestClient twitchAuthRestClient(IgdbProperties properties) {
    return RestClient.builder()
        .baseUrl(properties.authUrl())
        .messageConverters(this::useSnakeCaseJson)
        .requestFactory(ExternalApiRequestFactory.create())
        .build();
  }

  private void useSnakeCaseJson(List<HttpMessageConverter<?>> converters) {
    JsonMapper snakeCaseMapper =
        JsonMapper.builder()
            .propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
            .build();
    converters.add(0, new MappingJackson2HttpMessageConverter(snakeCaseMapper));
  }
}
