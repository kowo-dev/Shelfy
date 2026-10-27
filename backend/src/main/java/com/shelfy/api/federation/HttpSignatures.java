package com.shelfy.api.federation;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class HttpSignatures {

  public static final Duration CLOCK_SKEW = Duration.ofHours(1);

  private static final DateTimeFormatter HTTP_DATE =
      DateTimeFormatter.RFC_1123_DATE_TIME.withZone(ZoneOffset.UTC);
  private static final DateTimeFormatter HTTP_DATE_OUT =
      DateTimeFormatter.ofPattern("EEE, dd MMM yyyy HH:mm:ss 'GMT'", Locale.ENGLISH)
          .withZone(ZoneOffset.UTC);
  private static final Pattern PARAM = Pattern.compile("(\\w+)=\"([^\"]*)\"");
  private static final String REQUEST_TARGET = "(request-target)";

  private HttpSignatures() {}

  public record Parsed(String keyId, String algorithm, List<String> headers, byte[] signature) {}

  public static Map<String, String> sign(
      String method, URI uri, byte[] body, String keyId, PrivateKey key, Instant now) {
    Map<String, String> signed = new LinkedHashMap<>();
    signed.put("host", host(uri));
    signed.put("date", HTTP_DATE_OUT.format(now));
    if (body != null) {
      signed.put("digest", digest(body));
    }
    List<String> names = new ArrayList<>();
    names.add(REQUEST_TARGET);
    names.addAll(signed.keySet());
    String target = method.toLowerCase(Locale.ROOT) + " " + pathAndQuery(uri);
    byte[] signingString =
        signingString(names, target, signed::get).getBytes(StandardCharsets.UTF_8);
    String signature = Base64.getEncoder().encodeToString(rsa(key, signingString));
    Map<String, String> headers = new LinkedHashMap<>();
    headers.put("Date", signed.get("date"));
    if (body != null) {
      headers.put("Digest", signed.get("digest"));
    }
    headers.put(
        "Signature",
        "keyId=\""
            + keyId
            + "\",algorithm=\"rsa-sha256\",headers=\""
            + String.join(" ", names)
            + "\",signature=\""
            + signature
            + "\"");
    return headers;
  }

  public static Parsed parse(String header) {
    if (header == null || header.isBlank()) {
      throw new SignatureException("Missing Signature header");
    }
    Map<String, String> params = new LinkedHashMap<>();
    Matcher matcher = PARAM.matcher(header);
    while (matcher.find()) {
      params.put(matcher.group(1), matcher.group(2));
    }
    String keyId = params.get("keyId");
    String signature = params.get("signature");
    if (keyId == null || signature == null) {
      throw new SignatureException("Signature header needs keyId and signature");
    }
    List<String> headers =
        Arrays.asList(params.getOrDefault("headers", "date").toLowerCase(Locale.ROOT).split(" "));
    try {
      return new Parsed(
          keyId,
          params.getOrDefault("algorithm", "rsa-sha256"),
          headers,
          Base64.getDecoder().decode(signature));
    } catch (IllegalArgumentException e) {
      throw new SignatureException("Signature is not valid base64");
    }
  }

  public static void verify(
      Parsed parsed,
      String method,
      String pathAndQuery,
      Function<String, String> header,
      byte[] body,
      PublicKey key,
      Instant now) {
    String algorithm = parsed.algorithm().toLowerCase(Locale.ROOT);
    if (!algorithm.equals("rsa-sha256") && !algorithm.equals("hs2019")) {
      throw new SignatureException("Unsupported signature algorithm " + parsed.algorithm());
    }
    List<String> names = parsed.headers();
    if (!names.contains(REQUEST_TARGET) || !names.contains("host") || !names.contains("date")) {
      throw new SignatureException("Signature must cover (request-target), host and date");
    }
    checkDate(header.apply("date"), now);
    if (body != null && body.length > 0) {
      String received = header.apply("digest");
      if (!names.contains("digest") || received == null) {
        throw new SignatureException("Signature must cover the digest of the body");
      }
      if (!MessageDigest.isEqual(
          digest(body).getBytes(StandardCharsets.US_ASCII),
          received.trim().getBytes(StandardCharsets.US_ASCII))) {
        throw new SignatureException("Digest does not match the body");
      }
    }
    String target = method.toLowerCase(Locale.ROOT) + " " + pathAndQuery;
    byte[] signingString = signingString(names, target, header).getBytes(StandardCharsets.UTF_8);
    boolean valid;
    try {
      Signature verifier = Signature.getInstance("SHA256withRSA");
      verifier.initVerify(key);
      verifier.update(signingString);
      valid = verifier.verify(parsed.signature());
    } catch (GeneralSecurityException e) {
      valid = false;
    }
    if (!valid) {
      throw new SignatureException("Signature does not match");
    }
  }

  public static String digest(byte[] body) {
    try {
      return "SHA-256="
          + Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256").digest(body));
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException("SHA-256 is not available", e);
    }
  }

  public static String pathAndQuery(URI uri) {
    String path = uri.getRawPath() == null || uri.getRawPath().isEmpty() ? "/" : uri.getRawPath();
    return uri.getRawQuery() == null ? path : path + "?" + uri.getRawQuery();
  }

  private static String host(URI uri) {
    return uri.getPort() == -1 ? uri.getHost() : uri.getHost() + ":" + uri.getPort();
  }

  private static void checkDate(String value, Instant now) {
    if (value == null) {
      throw new SignatureException("Missing Date header");
    }
    Instant date;
    try {
      date = Instant.from(HTTP_DATE.parse(value.trim()));
    } catch (DateTimeParseException e) {
      throw new SignatureException("Date header is not a valid HTTP date");
    }
    if (Duration.between(date, now).abs().compareTo(CLOCK_SKEW) > 0) {
      throw new SignatureException("Date header is too far from the current time");
    }
  }

  private static String signingString(
      List<String> names, String target, Function<String, String> header) {
    List<String> lines = new ArrayList<>();
    for (String name : names) {
      if (name.equals(REQUEST_TARGET)) {
        lines.add(REQUEST_TARGET + ": " + target);
        continue;
      }
      String value = header.apply(name);
      if (value == null) {
        throw new SignatureException("Signed header " + name + " is missing");
      }
      lines.add(name + ": " + value.trim());
    }
    return String.join("\n", lines);
  }

  private static byte[] rsa(PrivateKey key, byte[] data) {
    try {
      Signature signer = Signature.getInstance("SHA256withRSA");
      signer.initSign(key);
      signer.update(data);
      return signer.sign();
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException("Could not sign the request", e);
    }
  }

  public static class SignatureException extends RuntimeException {
    public SignatureException(String message) {
      super(message);
    }
  }
}
