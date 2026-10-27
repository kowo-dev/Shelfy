package com.shelfy.api.auth.oauth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class OAuthStateService {

  private static final Duration STATE_TTL = Duration.ofMinutes(10);

  private final OAuthStateRepository repository;
  private final SecureRandom secureRandom = new SecureRandom();

  @Transactional
  public OAuthStateTransaction create(OAuthProvider provider, UUID userId) {
    String state = randomToken();
    String browserToken = randomToken();
    repository.save(
        new OAuthStateEntity(
            userId, provider, hash(state), hash(browserToken), Instant.now().plus(STATE_TTL)));
    return new OAuthStateTransaction(state, browserToken);
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public Optional<UUID> consume(OAuthProvider provider, String state, String browserToken) {
    if (state == null || browserToken == null) {
      return Optional.empty();
    }
    return repository
        .findByStateHashAndProvider(hash(state), provider)
        .filter(
            oauthState ->
                repository.markUsedIfValid(oauthState.getId(), hash(browserToken), Instant.now())
                    == 1)
        .map(OAuthStateEntity::getUserId);
  }

  public Duration ttl() {
    return STATE_TTL;
  }

  private String randomToken() {
    byte[] bytes = new byte[32];
    secureRandom.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  private String hash(String value) {
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException ex) {
      throw new IllegalStateException("SHA-256 is unavailable", ex);
    }
  }
}
