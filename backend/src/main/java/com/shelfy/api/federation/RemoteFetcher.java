package com.shelfy.api.federation;

import java.io.IOException;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
public class RemoteFetcher {

  static final int MAX_BODY_BYTES = 1024 * 1024;
  static final String ACTIVITY_JSON =
      "application/activity+json, application/ld+json; profile=\"https://www.w3.org/ns/activitystreams\"";
  private static final String JRD_JSON = "application/jrd+json, application/json";
  private static final int MAX_REDIRECTS = 3;
  private static final Duration TIMEOUT = Duration.ofSeconds(10);
  private static final Duration DEADLINE = Duration.ofSeconds(15);

  private final HttpClient httpClient;
  private final ObjectMapper objectMapper;
  private final ActorStore actorStore;
  private final DomainPolicy domainPolicy;
  private final FederationProperties properties;
  private final Clock clock;

  @Autowired
  public RemoteFetcher(
      ObjectMapper objectMapper,
      ActorStore actorStore,
      DomainPolicy domainPolicy,
      FederationProperties properties) {
    this(
        HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build(),
        objectMapper,
        actorStore,
        domainPolicy,
        properties,
        Clock.systemUTC());
  }

  RemoteFetcher(
      HttpClient httpClient,
      ObjectMapper objectMapper,
      ActorStore actorStore,
      DomainPolicy domainPolicy,
      FederationProperties properties,
      Clock clock) {
    this.httpClient = httpClient;
    this.objectMapper = objectMapper;
    this.actorStore = actorStore;
    this.domainPolicy = domainPolicy;
    this.properties = properties;
    this.clock = clock;
  }

  public record Fetched(byte[] body, String contentType) {}

  public JsonNode fetchActivity(URI uri) {
    return json(uri, fetch(uri, ACTIVITY_JSON, true, MAX_BODY_BYTES));
  }

  public JsonNode fetchJrd(URI uri) {
    return json(uri, fetch(uri, JRD_JSON, false, MAX_BODY_BYTES));
  }

  public Fetched fetchImage(URI uri, int maxBytes) {
    return fetch(uri, "image/webp, image/png, image/jpeg", false, maxBytes);
  }

  public void checkTarget(URI uri) {
    String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
    boolean schemeAllowed =
        scheme.equals("https") || (properties.devMode() && scheme.equals("http"));
    if (!schemeAllowed || uri.getHost() == null || uri.getRawUserInfo() != null) {
      throw new RemoteFetchException("Refusing to contact " + uri);
    }
    if (!domainPolicy.isAllowed(uri.getHost())) {
      throw new RemoteFetchException("Domain is not allowed: " + uri.getHost());
    }
    if (properties.devMode()) {
      return;
    }
    try {
      for (InetAddress address : InetAddress.getAllByName(uri.getHost())) {
        if (isPrivate(address)) {
          throw new RemoteFetchException("Refusing to contact a private address for " + uri);
        }
      }
    } catch (UnknownHostException e) {
      throw new RemoteFetchException("Unknown host " + uri.getHost());
    }
  }

  static boolean isPrivate(InetAddress address) {
    if (address.isAnyLocalAddress()
        || address.isLoopbackAddress()
        || address.isLinkLocalAddress()
        || address.isSiteLocalAddress()
        || address.isMulticastAddress()) {
      return true;
    }
    byte[] bytes = address.getAddress();
    if (address instanceof Inet6Address) {
      return (bytes[0] & 0xfe) == 0xfc;
    }
    int first = bytes[0] & 0xff;
    int second = bytes[1] & 0xff;
    return first == 0 || (first == 100 && second >= 64 && second < 128) || first >= 224;
  }

  private Fetched fetch(URI start, String accept, boolean signed, int maxBytes) {
    URI uri = start;
    for (int redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      checkTarget(uri);
      HttpResponse<byte[]> response = send(uri, accept, signed, maxBytes);
      int status = response.statusCode();
      if (status >= 300 && status < 400) {
        String location = response.headers().firstValue("location").orElse(null);
        if (location == null) {
          throw new RemoteFetchException("Redirect without location from " + uri);
        }
        uri = uri.resolve(location);
        continue;
      }
      if (status != 200) {
        String detail = errorDetail(response);
        throw new RemoteFetchException(
            "Got HTTP " + status + " from " + uri + (detail.isEmpty() ? "" : ": " + detail),
            status);
      }
      return new Fetched(
          response.body(), response.headers().firstValue("content-type").orElse(null));
    }
    throw new RemoteFetchException("Too many redirects from " + start);
  }

  private HttpResponse<byte[]> send(URI uri, String accept, boolean signed, int maxBytes) {
    HttpRequest.Builder request =
        HttpRequest.newBuilder(uri).timeout(TIMEOUT).header("Accept", accept).GET();
    request.header("User-Agent", "Shelfy (+" + properties.serverUrl() + ")");
    if (signed) {
      ActorStore.KeyPem key = actorStore.instanceKey();
      Map<String, String> headers =
          HttpSignatures.sign(
              "GET",
              uri,
              null,
              key.keyId(),
              RsaKeys.parsePrivate(key.privatePem()),
              clock.instant());
      headers.forEach(request::header);
    }
    try {
      return sendWithin(
          httpClient,
          request.build(),
          HttpResponse.BodyHandlers.limiting(HttpResponse.BodyHandlers.ofByteArray(), maxBytes),
          DEADLINE);
    } catch (IOException e) {
      throw new RemoteFetchException("Could not reach " + uri + ": " + e.getMessage());
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new RemoteFetchException("Interrupted while fetching " + uri);
    }
  }

  // The request timeout only covers the headers: a server trickling its body would otherwise hold
  // the calling thread forever, so the whole exchange must finish within the deadline
  static <T> HttpResponse<T> sendWithin(
      HttpClient client,
      HttpRequest request,
      HttpResponse.BodyHandler<T> handler,
      Duration deadline)
      throws IOException, InterruptedException {
    CompletableFuture<HttpResponse<T>> response = client.sendAsync(request, handler);
    try {
      return response.get(deadline.toMillis(), TimeUnit.MILLISECONDS);
    } catch (TimeoutException e) {
      throw new HttpTimeoutException("No complete response within " + deadline.toSeconds() + "s");
    } catch (ExecutionException e) {
      if (e.getCause() instanceof IOException cause) {
        throw cause;
      }
      throw new IOException(e.getCause());
    } finally {
      response.cancel(true);
    }
  }

  private JsonNode json(URI uri, Fetched fetched) {
    try {
      JsonNode node = objectMapper.readTree(fetched.body());
      if (node == null || !node.isObject()) {
        throw new RemoteFetchException("Response from " + uri + " is not a JSON object");
      }
      return node;
    } catch (JacksonException e) {
      throw new RemoteFetchException("Invalid response from " + uri);
    }
  }

  private static String errorDetail(HttpResponse<byte[]> response) {
    byte[] body = response.body();
    String text = new String(body, 0, Math.min(body.length, 300), StandardCharsets.UTF_8);
    return text.replaceAll("\\s+", " ").strip();
  }

  public static class RemoteFetchException extends RuntimeException {
    private final int status;

    public RemoteFetchException(String message) {
      this(message, 0);
    }

    public RemoteFetchException(String message, int status) {
      super(message);
      this.status = status;
    }

    public int status() {
      return status;
    }
  }
}
