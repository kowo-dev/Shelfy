package com.shelfy.api.config;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.ClassPathResource;

class SpringdocProductionConfigurationTest {

  @Test
  void production_disablesOpenApiAndSwaggerUi() {
    YamlPropertiesFactoryBean yaml = new YamlPropertiesFactoryBean();
    yaml.setResources(new ClassPathResource("application-prod.yml"));
    yaml.afterPropertiesSet();

    assertEquals("false", yaml.getObject().getProperty("springdoc.api-docs.enabled"));
    assertEquals("false", yaml.getObject().getProperty("springdoc.swagger-ui.enabled"));
  }
}
