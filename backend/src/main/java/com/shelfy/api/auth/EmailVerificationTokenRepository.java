package com.shelfy.api.auth;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmailVerificationTokenRepository
    extends JpaRepository<EmailVerificationTokenEntity, UUID> {

  Optional<EmailVerificationTokenEntity> findByTokenHash(String tokenHash);

  boolean existsByUserIdAndCreatedAtAfter(UUID userId, Instant after);

  @Modifying
  @Query("delete from EmailVerificationTokenEntity token where token.expiresAt < :cutoff")
  int deleteExpiredBefore(@Param("cutoff") Instant cutoff);
}
