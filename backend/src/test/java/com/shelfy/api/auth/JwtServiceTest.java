package com.shelfy.api.auth;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

  private static final String SECRET =
      "test-only-access-token-secret-do-not-use-in-production-min-32-bytes";
  private static final String ISSUER = "shelfy-api";
  private static final String AUDIENCE = "shelfy-web";

  private final JwtService jwtService =
      new JwtService(new JwtProperties(SECRET, ISSUER, AUDIENCE, 15, 7));

  @Test
  void accessToken_isAcceptedWhenAllRequiredClaimsMatch() {
    UserEntity user = new UserEntity("user@example.com", "user", "hash");
    user.setId(UUID.randomUUID());

    assertTrue(jwtService.isValid(jwtService.generateAccessToken(user)));
  }

  @Test
  void signedTokenWithoutAccessTokenClaims_isRejected() {
    SecretKey signingKey = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
    String stateLikeToken =
        Jwts.builder()
            .subject(UUID.randomUUID().toString())
            .issuedAt(Date.from(Instant.now()))
            .expiration(Date.from(Instant.now().plusSeconds(600)))
            .claim("purpose", "oauth-state")
            .signWith(signingKey)
            .compact();

    assertFalse(jwtService.isValid(stateLikeToken));
  }

  @Test
  void accessTokenWithWrongAudience_isRejected() {
    SecretKey signingKey = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
    String wrongAudienceToken =
        Jwts.builder()
            .header()
            .type("JWT")
            .and()
            .subject(UUID.randomUUID().toString())
            .issuer(ISSUER)
            .claim("aud", "another-client")
            .claim("token_use", "access")
            .issuedAt(Date.from(Instant.now()))
            .expiration(Date.from(Instant.now().plusSeconds(600)))
            .signWith(signingKey)
            .compact();

    assertFalse(jwtService.isValid(wrongAudienceToken));
  }
}
