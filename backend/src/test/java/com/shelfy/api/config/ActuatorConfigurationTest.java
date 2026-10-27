package com.shelfy.api.config;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.FileSystemResource;

class ActuatorConfigurationTest {

  @Test
  void actuatorWebExposure_isLimitedToHealth() {
    YamlPropertiesFactoryBean yaml = new YamlPropertiesFactoryBean();
    yaml.setResources(new FileSystemResource(Path.of("src/main/resources/application.yml")));
    yaml.afterPropertiesSet();

    assertEquals(
        "health", yaml.getObject().getProperty("management.endpoints.web.exposure.include"));
  }
}
