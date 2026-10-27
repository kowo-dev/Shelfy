package com.shelfy.api.federation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class RemoteFetcherDeadlineTest {

  private final HttpClient client = HttpClient.newHttpClient();
  private HttpServer server;

  @BeforeEach
  void start() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext(
        "/slow",
        exchange -> {
          exchange.sendResponseHeaders(200, 1000);
          try (OutputStream out = exchange.getResponseBody()) {
            for (int i = 0; i < 1000; i++) {
              out.write('x');
              out.flush();
              Thread.sleep(100);
            }
          } catch (InterruptedException | IOException ignored) {
            // the client gave up
          }
        });
    server.createContext(
        "/large",
        exchange -> {
          byte[] body = new byte[4096];
          exchange.sendResponseHeaders(200, body.length);
          try (OutputStream out = exchange.getResponseBody()) {
            out.write(body);
          }
        });
    server.createContext(
        "/ok",
        exchange -> {
          byte[] body = "hello".getBytes(StandardCharsets.UTF_8);
          exchange.sendResponseHeaders(200, body.length);
          try (OutputStream out = exchange.getResponseBody()) {
            out.write(body);
          }
        });
    server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
    server.start();
  }

  @AfterEach
  void stop() {
    server.stop(0);
  }

  @Test
  void aBodyTrickledSlowerThanTheDeadlineIsAbandoned() {
    long start = System.nanoTime();
    assertThatThrownBy(
            () ->
                RemoteFetcher.sendWithin(
                    client,
                    request("/slow"),
                    HttpResponse.BodyHandlers.ofByteArray(),
                    Duration.ofSeconds(1)))
        .isInstanceOf(HttpTimeoutException.class);
    assertThat(Duration.ofNanos(System.nanoTime() - start)).isLessThan(Duration.ofSeconds(5));
  }

  @Test
  void aBodyOverTheLimitIsRefused() {
    assertThatThrownBy(
            () ->
                RemoteFetcher.sendWithin(
                    client,
                    request("/large"),
                    HttpResponse.BodyHandlers.limiting(
                        HttpResponse.BodyHandlers.ofByteArray(), 1024),
                    Duration.ofSeconds(5)))
        .isInstanceOf(IOException.class);
  }

  @Test
  void aNormalResponseIsReturned() throws Exception {
    HttpResponse<byte[]> response =
        RemoteFetcher.sendWithin(
            client,
            request("/ok"),
            HttpResponse.BodyHandlers.limiting(HttpResponse.BodyHandlers.ofByteArray(), 1024),
            Duration.ofSeconds(5));
    assertThat(new String(response.body(), StandardCharsets.UTF_8)).isEqualTo("hello");
  }

  private HttpRequest request(String path) {
    return HttpRequest.newBuilder(
            URI.create("http://127.0.0.1:" + server.getAddress().getPort() + path))
        .build();
  }
}
