package com.shelfy.api.auth;

import java.nio.file.Path;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class AvatarResourceConfig implements WebMvcConfigurer {

  private final AvatarStorageProperties avatarStorageProperties;

  @Override
  public void addResourceHandlers(ResourceHandlerRegistry registry) {
    String location = Path.of(avatarStorageProperties.directory()).toUri().toString();
    registry.addResourceHandler("/uploads/avatars/**").addResourceLocations(location);
  }
}
