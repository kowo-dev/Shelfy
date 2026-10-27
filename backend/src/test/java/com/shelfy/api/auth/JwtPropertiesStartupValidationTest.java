package com.shelfy.api.auth;

import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

class JwtPropertiesStartupValidationTest {

  private static final String VALID_SECRET =
      "a-valid-jwt-secret-that-is-at-least-32-characters-long";

  @Test
  void missingJwtProperties_preventApplicationStartup() {
    contextRunner().run(context -> assertNotNull(context.getStartupFailure()));
  }

  @Test
  void shortJwtSecret_preventsApplicationStartup() {
    contextRunner("short", "shelfy-api", "shelfy-web", "15", "7")
        .run(context -> assertNotNull(context.getStartupFailure()));
  }

  @Test
  void nonPositiveJwtDurations_preventApplicationStartup() {
    contextRunner(VALID_SECRET, "shelfy-api", "shelfy-web", "0", "-1")
        .run(context -> assertNotNull(context.getStartupFailure()));
  }

  private ApplicationContextRunner contextRunner() {
    return new ApplicationContextRunner().withUserConfiguration(JwtPropertiesConfiguration.class);
  }

  private ApplicationContextRunner contextRunner(
      String secret,
      String issuer,
      String audience,
      String accessTokenExpiration,
      String refreshTokenExpiration) {
    return contextRunner()
        .withPropertyValues(
            "app.jwt.access-token-secret=" + secret,
            "app.jwt.issuer=" + issuer,
            "app.jwt.audience=" + audience,
            "app.jwt.access-token-expiration-minutes=" + accessTokenExpiration,
            "app.jwt.refresh-token-expiration-days=" + refreshTokenExpiration);
  }

  @Configuration(proxyBeanMethods = false)
  @EnableConfigurationProperties(JwtProperties.class)
  static class JwtPropertiesConfiguration {}
}
