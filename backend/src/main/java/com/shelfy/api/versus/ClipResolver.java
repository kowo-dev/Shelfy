package com.shelfy.api.versus;

import com.shelfy.api.common.exception.BadRequestException;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.http.ExternalApiRequestFactory;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class ClipResolver {
  private static final int MAX_TITLE = 300;
  private static final int MAX_AUTHOR = 200;
  private static final int MAX_IMAGE = 2 * 1024 * 1024;
  private static final String LETTERBOXED = "/hqdefault.jpg";
  private static final String WIDESCREEN = "/hq720.jpg";

  private final RestClient http =
      RestClient.builder().requestFactory(ExternalApiRequestFactory.create()).build();

  public ClipInfo resolve(String url) {
    ClipUrlParser.ClipRef ref = ClipUrlParser.parse(url);
    String canonical = canonicalUrl(ref.provider(), ref.externalId());
    String endpoint = "https://www.youtube.com/oembed?format=json&url=";
    Map<?, ?> body;
    try {
      body =
          http.get()
              .uri(URI.create(endpoint + URLEncoder.encode(canonical, StandardCharsets.UTF_8)))
              .accept(MediaType.APPLICATION_JSON)
              .retrieve()
              .body(Map.class);
    } catch (RestClientException e) {
      throw unavailable();
    }
    if (body == null || !(body.get("title") instanceof String title) || title.isBlank()) {
      throw unavailable();
    }
    String author = body.get("author_name") instanceof String a ? truncate(a, MAX_AUTHOR) : null;
    String thumbnail =
        body.get("thumbnail_url") instanceof String t && isAllowedThumbnail(t) ? t : null;
    return new ClipInfo(
        ref.provider(),
        ref.externalId(),
        truncate(title.strip(), MAX_TITLE),
        author,
        thumbnail,
        ref.startSeconds());
  }

  public ResponseEntity<byte[]> fetchThumbnail(String url) {
    if (!isAllowedThumbnail(url)) {
      throw unavailable();
    }
    if (url.endsWith(WIDESCREEN)) {
      try {
        return download(url);
      } catch (BadRequestException e) {
        return download(url.substring(0, url.length() - WIDESCREEN.length()) + LETTERBOXED);
      }
    }
    return download(url);
  }

  static String widescreen(String url) {
    return url != null && url.endsWith(LETTERBOXED) && isAllowedThumbnail(url)
        ? url.substring(0, url.length() - LETTERBOXED.length()) + WIDESCREEN
        : url;
  }

  private ResponseEntity<byte[]> download(String url) {
    ResponseEntity<byte[]> upstream;
    try {
      upstream = http.get().uri(URI.create(url)).retrieve().toEntity(byte[].class);
    } catch (RestClientException e) {
      throw unavailable();
    }
    MediaType type = upstream.getHeaders().getContentType();
    byte[] body = upstream.getBody();
    if (type == null
        || !"image".equals(type.getType())
        || body == null
        || body.length > MAX_IMAGE) {
      throw unavailable();
    }
    return ResponseEntity.ok()
        .contentType(type)
        .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic())
        .body(body);
  }

  static String canonicalUrl(ClipProvider provider, String externalId) {
    return switch (provider) {
      case YOUTUBE -> "https://www.youtube.com/watch?v=" + externalId;
    };
  }

  static boolean isAllowedThumbnail(String url) {
    try {
      URI uri = URI.create(url);
      String host = uri.getHost();
      return "https".equals(uri.getScheme()) && host != null && "i.ytimg.com".equals(host);
    } catch (IllegalArgumentException e) {
      return false;
    }
  }

  private static String truncate(String value, int max) {
    return value.length() <= max ? value : value.substring(0, max);
  }

  private static BadRequestException unavailable() {
    return new BadRequestException(
        ErrorCode.VERSUS_CLIP_UNAVAILABLE, "This clip cannot be found or embedded");
  }
}
