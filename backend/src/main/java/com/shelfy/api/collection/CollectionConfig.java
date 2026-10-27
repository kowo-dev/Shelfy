package com.shelfy.api.collection;

import org.springframework.context.annotation.Configuration;
import org.springframework.format.FormatterRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CollectionConfig implements WebMvcConfigurer {

  @Override
  public void addFormatters(FormatterRegistry registry) {
    registry.addConverter(String.class, MediaType.class, MediaType::fromString);
    registry.addConverter(String.class, UserMediaStatus.class, UserMediaStatus::fromString);
  }
}
