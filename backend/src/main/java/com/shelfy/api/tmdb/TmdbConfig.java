package com.shelfy.api.tmdb;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.shelfy.api.common.http.ExternalApiRequestFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.web.client.RestClient;

@Configuration
public class TmdbConfig {

  @Bean
  public RestClient tmdbRestClient(TmdbProperties properties) {
    JsonMapper snakeCaseMapper =
        JsonMapper.builder()
            .propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
            .build();
    MappingJackson2HttpMessageConverter converter =
        new MappingJackson2HttpMessageConverter(snakeCaseMapper);

    return RestClient.builder()
        .baseUrl(properties.url())
        .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + properties.accessToken())
        .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
        .messageConverters(converters -> converters.add(0, converter))
        .requestFactory(ExternalApiRequestFactory.create())
        .build();
  }
}
