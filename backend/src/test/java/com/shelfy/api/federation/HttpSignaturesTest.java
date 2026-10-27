package com.shelfy.api.federation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import org.junit.jupiter.api.Test;

class HttpSignaturesTest {

  private static final KeyPair KEYS = RsaKeys.generate();
  private static final URI INBOX = URI.create("https://remote.example/users/bob/inbox?x=1");
  private static final Instant NOW = Instant.parse("2026-10-19T12:00:00Z");
  private static final byte[] BODY = "{\"type\":\"Follow\"}".getBytes(StandardCharsets.UTF_8);

  @Test
  void signedPostVerifies() {
    Map<String, String> headers = received(sign(BODY));

    HttpSignatures.verify(
        HttpSignatures.parse(headers.get("signature")),
        "POST",
        "/users/bob/inbox?x=1",
        headers::get,
        BODY,
        KEYS.getPublic(),
        NOW.plusSeconds(30));
  }

  @Test
  void signatureNamesTheSignedHeaders() {
    HttpSignatures.Parsed parsed = HttpSignatures.parse(received(sign(BODY)).get("signature"));

    assertThat(parsed.keyId()).isEqualTo("https://local.example/ap/users/1#main-key");
    assertThat(parsed.headers()).containsExactly("(request-target)", "host", "date", "digest");
  }

  @Test
  void tamperedBodyIsRejected() {
    Map<String, String> headers = received(sign(BODY));
    byte[] tampered = "{\"type\":\"Delete\"}".getBytes(StandardCharsets.UTF_8);

    assertThatThrownBy(() -> verify(headers, tampered, NOW))
        .isInstanceOf(HttpSignatures.SignatureException.class)
        .hasMessageContaining("Digest");
  }

  @Test
  void forgedDigestIsRejected() {
    Map<String, String> headers = received(sign(BODY));
    byte[] tampered = "{\"type\":\"Delete\"}".getBytes(StandardCharsets.UTF_8);
    headers.put("digest", HttpSignatures.digest(tampered));

    assertThatThrownBy(() -> verify(headers, tampered, NOW))
        .isInstanceOf(HttpSignatures.SignatureException.class)
        .hasMessageContaining("does not match");
  }

  @Test
  void otherKeyIsRejected() {
    Map<String, String> headers = received(sign(BODY));

    assertThatThrownBy(
            () ->
                HttpSignatures.verify(
                    HttpSignatures.parse(headers.get("signature")),
                    "POST",
                    "/users/bob/inbox?x=1",
                    headers::get,
                    BODY,
                    RsaKeys.generate().getPublic(),
                    NOW))
        .isInstanceOf(HttpSignatures.SignatureException.class);
  }

  @Test
  void oldDateIsRejected() {
    Map<String, String> headers = received(sign(BODY));

    assertThatThrownBy(
            () ->
                verify(
                    headers, BODY, NOW.plus(HttpSignatures.CLOCK_SKEW).plus(Duration.ofMinutes(1))))
        .isInstanceOf(HttpSignatures.SignatureException.class)
        .hasMessageContaining("Date");
  }

  @Test
  void signatureWithoutRequestTargetIsRejected() {
    Map<String, String> headers = received(sign(BODY));
    headers.put("signature", headers.get("signature").replace("(request-target) host", "host"));

    assertThatThrownBy(() -> verify(headers, BODY, NOW))
        .isInstanceOf(HttpSignatures.SignatureException.class)
        .hasMessageContaining("(request-target)");
  }

  @Test
  void otherPathIsRejected() {
    Map<String, String> headers = received(sign(BODY));

    assertThatThrownBy(
            () ->
                HttpSignatures.verify(
                    HttpSignatures.parse(headers.get("signature")),
                    "POST",
                    "/users/alice/inbox",
                    headers::get,
                    BODY,
                    KEYS.getPublic(),
                    NOW))
        .isInstanceOf(HttpSignatures.SignatureException.class);
  }

  @Test
  void pemRoundTrips() {
    assertThat(RsaKeys.parsePublic(RsaKeys.publicPem(KEYS.getPublic())))
        .isEqualTo(KEYS.getPublic());
    assertThat(RsaKeys.parsePrivate(RsaKeys.privatePem(KEYS.getPrivate())))
        .isEqualTo(KEYS.getPrivate());
  }

  private static Map<String, String> sign(byte[] body) {
    return HttpSignatures.sign(
        "POST", INBOX, body, "https://local.example/ap/users/1#main-key", KEYS.getPrivate(), NOW);
  }

  private static Map<String, String> received(Map<String, String> sent) {
    Map<String, String> headers = new HashMap<>();
    sent.forEach((name, value) -> headers.put(name.toLowerCase(Locale.ROOT), value));
    headers.put("host", "remote.example");
    return headers;
  }

  private static void verify(Map<String, String> headers, byte[] body, Instant now) {
    HttpSignatures.verify(
        HttpSignatures.parse(headers.get("signature")),
        "POST",
        "/users/bob/inbox?x=1",
        headers::get,
        body,
        KEYS.getPublic(),
        now);
  }
}
