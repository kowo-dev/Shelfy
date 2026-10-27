package com.shelfy.api.auth.oauth;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OAuthStateRepository extends JpaRepository<OAuthStateEntity, UUID> {

  Optional<OAuthStateEntity> findByStateHashAndProvider(String stateHash, OAuthProvider provider);

  @Modifying
  @Query(
      """
      update OAuthStateEntity state
      set state.usedAt = :now
      where state.id = :id
        and state.usedAt is null
        and state.expiresAt > :now
        and state.browserTokenHash = :browserTokenHash
      """)
  int markUsedIfValid(
      @Param("id") UUID id,
      @Param("browserTokenHash") String browserTokenHash,
      @Param("now") Instant now);
}
