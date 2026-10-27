package com.shelfy.api.federation;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Function;
import javax.imageio.ImageIO;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

final class RemoteStub implements AutoCloseable {

  static final JsonMapper JSON = JsonMapper.builder().build();

  record Received(String path, JsonNode body, String signatureCheck) {}

  final KeyPair keys = RsaKeys.generate();
  final String name = "r" + UUID.randomUUID().toString().substring(0, 8);
  final List<Received> inbox = new CopyOnWriteArrayList<>();
  volatile String visibility = "public";
  volatile boolean knowsNobody;
  volatile String alsoKnownAs;
  private final HttpServer server;
  private final Function<String, String> localKeyPem;

  RemoteStub(Function<String, String> localKeyPem) throws IOException {
    this.localKeyPem = localKeyPem;
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/.well-known/webfinger", this::webFinger);
    server.createContext("/users/", this::actor);
    server.createContext("/inbox", this::receive);
    server.createContext("/avatar.png", this::avatar);
    server.start();
  }

  String authority() {
    return "127.0.0.1:" + server.getAddress().getPort();
  }

  String actorUri() {
    return "http://" + authority() + "/users/" + name;
  }

  String handle() {
    return name + "@" + authority();
  }

  Map<String, String> sign(URI target, byte[] body) {
    return HttpSignatures.sign(
        "POST", target, body, actorUri() + "#main-key", keys.getPrivate(), Instant.now());
  }

  @Override
  public void close() {
    server.stop(0);
  }

  private void webFinger(HttpExchange exchange) throws IOException {
    if (knowsNobody) {
      exchange.sendResponseHeaders(404, -1);
      exchange.close();
      return;
    }
    reply(
        exchange,
        """
        {"subject": "acct:%s",
         "links": [{"rel": "self", "type": "application/activity+json", "href": "%s"},
                   {"rel": "http://ostatus.org/schema/1.0/subscribe",
                    "template": "http://%s/authorize_interaction?uri={uri}"}]}
        """
            .formatted(handle(), actorUri(), authority()));
  }

  private void actor(HttpExchange exchange) throws IOException {
    reply(
        exchange,
        """
        {"@context": "https://www.w3.org/ns/activitystreams",
         "id": "%1$s", "type": "Person", "preferredUsername": "%2$s", "name": "Remote",
         "inbox": "http://%3$s/inbox", "shelfy:profileVisibility": "%5$s",
         "alsoKnownAs": %6$s,
         "icon": {"type": "Image", "url": "http://%3$s/avatar.png"},
         "publicKey": {"id": "%1$s#main-key", "owner": "%1$s", "publicKeyPem": %4$s}}
        """
            .formatted(
                actorUri(),
                name,
                authority(),
                JSON.writeValueAsString(RsaKeys.publicPem(keys.getPublic())),
                visibility,
                alsoKnownAs == null ? "[]" : "[\"" + alsoKnownAs + "\"]"));
  }

  private void receive(HttpExchange exchange) throws IOException {
    byte[] body = exchange.getRequestBody().readAllBytes();
    String check;
    try {
      HttpSignatures.Parsed parsed =
          HttpSignatures.parse(exchange.getRequestHeaders().getFirst("Signature"));
      HttpSignatures.verify(
          parsed,
          "POST",
          exchange.getRequestURI().getRawPath(),
          header -> exchange.getRequestHeaders().getFirst(header),
          body,
          RsaKeys.parsePublic(localKeyPem.apply(parsed.keyId())),
          Instant.now());
      check = "valid";
    } catch (RuntimeException e) {
      check = e.getMessage();
    }
    inbox.add(new Received(exchange.getRequestURI().getPath(), JSON.readTree(body), check));
    exchange.sendResponseHeaders(202, -1);
    exchange.close();
  }

  private void avatar(HttpExchange exchange) throws IOException {
    ByteArrayOutputStream png = new ByteArrayOutputStream();
    ImageIO.write(new BufferedImage(4, 4, BufferedImage.TYPE_INT_RGB), "png", png);
    exchange.getResponseHeaders().add("Content-Type", "image/png");
    exchange.sendResponseHeaders(200, png.size());
    exchange.getResponseBody().write(png.toByteArray());
    exchange.close();
  }

  private static void reply(HttpExchange exchange, String body) throws IOException {
    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().add("Content-Type", "application/activity+json");
    exchange.sendResponseHeaders(200, bytes.length);
    exchange.getResponseBody().write(bytes);
    exchange.close();
  }
}
