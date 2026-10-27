package com.shelfy.api.auth.oauth;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class OAuthStateServiceTest {

  private final OAuthStateRepository repository = mock(OAuthStateRepository.class);
  private final OAuthStateService service = new OAuthStateService(repository);

  @Test
  void create_usesOpaqueRandomValuesAndStoresOnlyHashes() {
    UUID userId = UUID.randomUUID();

    OAuthStateTransaction transaction = service.create(OAuthProvider.STEAM, userId);

    ArgumentCaptor<OAuthStateEntity> stateCaptor = ArgumentCaptor.forClass(OAuthStateEntity.class);
    verify(repository).save(stateCaptor.capture());
    OAuthStateEntity stored = stateCaptor.getValue();
    assertFalse(transaction.state().contains("."));
    assertFalse(transaction.browserToken().contains("."));
    assertFalse(stored.getStateHash().equals(transaction.state()));
    assertFalse(stored.getBrowserTokenHash().equals(transaction.browserToken()));
    assertTrue(stored.getExpiresAt().isAfter(Instant.now()));
  }

  @Test
  void consume_requiresTheSameBrowserAndAllowsOnlyOneUse() {
    String state = "opaque-state";
    String browserToken = "browser-binding";
    UUID userId = UUID.randomUUID();
    OAuthStateEntity stored =
        new OAuthStateEntity(
            userId,
            OAuthProvider.STEAM,
            hash(state),
            hash(browserToken),
            Instant.now().plusSeconds(60));
    when(repository.findByStateHashAndProvider(hash(state), OAuthProvider.STEAM))
        .thenReturn(Optional.of(stored));
    when(repository.markUsedIfValid(any(), eq(hash(browserToken)), any())).thenReturn(1, 0);

    assertTrue(service.consume(OAuthProvider.STEAM, state, browserToken).isPresent());
    assertTrue(service.consume(OAuthProvider.STEAM, state, browserToken).isEmpty());
    assertTrue(service.consume(OAuthProvider.STEAM, state, "different-browser").isEmpty());
  }

  private String hash(String value) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException ex) {
      throw new IllegalStateException(ex);
    }
  }
}
