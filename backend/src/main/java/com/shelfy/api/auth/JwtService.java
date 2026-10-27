package com.shelfy.api.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import java.util.stream.StreamSupport;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

  private static final String TOKEN_USE_CLAIM = "token_use";
  private static final String ACCESS_TOKEN_USE = "access";

  private final SecretKey signingKey;
  private final Duration accessTokenTtl;
  private final String issuer;
  private final String audience;

  public JwtService(JwtProperties properties) {
    this.signingKey =
        Keys.hmacShaKeyFor(properties.accessTokenSecret().getBytes(StandardCharsets.UTF_8));
    this.accessTokenTtl = Duration.ofMinutes(properties.accessTokenExpirationMinutes());
    this.issuer = properties.issuer();
    this.audience = properties.audience();
  }

  public String generateAccessToken(UserEntity user) {
    Instant now = Instant.now();
    return Jwts.builder()
        .header()
        .type("JWT")
        .and()
        .subject(user.getId().toString())
        .issuer(issuer)
        .claim("aud", audience)
        .claim(TOKEN_USE_CLAIM, ACCESS_TOKEN_USE)
        .claim("email", user.getEmail())
        .claim("username", user.getUsername())
        .issuedAt(Date.from(now))
        .expiration(Date.from(now.plus(accessTokenTtl)))
        .signWith(signingKey)
        .compact();
  }

  public long accessTokenTtlSeconds() {
    return accessTokenTtl.toSeconds();
  }

  public UUID extractUserId(String token) {
    return UUID.fromString(parseClaims(token).getSubject());
  }

  public boolean isValid(String token) {
    try {
      parseClaims(token);
      return true;
    } catch (RuntimeException ex) {
      return false;
    }
  }

  private Claims parseClaims(String token) {
    Jws<Claims> jws = Jwts.parser().verifyWith(signingKey).build().parseSignedClaims(token);
    Claims claims = jws.getPayload();
    if (!"JWT".equals(jws.getHeader().getType())
        || !ACCESS_TOKEN_USE.equals(claims.get(TOKEN_USE_CLAIM, String.class))
        || !issuer.equals(claims.getIssuer())
        || !hasExpectedAudience(claims)) {
      throw new IllegalArgumentException("Invalid access token");
    }
    return claims;
  }

  private boolean hasExpectedAudience(Claims claims) {
    Object audiences = claims.get("aud");
    if (audiences instanceof String audienceValue) {
      return audience.equals(audienceValue);
    }
    return audiences instanceof Iterable<?> values
        && StreamSupport.stream(values.spliterator(), false).anyMatch(audience::equals);
  }
}
