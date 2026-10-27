package com.shelfy.api.config;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class CaddyAccessLogConfigurationTest {

  @Test
  void accessLogs_areStructuredAndExcludeRawUris() throws IOException {
    String caddyfile = Files.readString(findCaddyfile());

    assertTrue(caddyfile.contains("output stdout"));
    assertTrue(caddyfile.contains("wrap json"));
    assertTrue(caddyfile.contains("request>uri delete"));
    assertTrue(caddyfile.contains("log_append request_path {http.request.uri.path}"));
  }

  private Path findCaddyfile() {
    Path directory = Path.of("").toAbsolutePath();
    while (directory != null) {
      Path candidate = directory.resolve("docker/Caddyfile");
      if (Files.isRegularFile(candidate)) {
        return candidate;
      }
      directory = directory.getParent();
    }
    throw new IllegalStateException(
        "docker/Caddyfile not found from the current working directory");
  }
}
