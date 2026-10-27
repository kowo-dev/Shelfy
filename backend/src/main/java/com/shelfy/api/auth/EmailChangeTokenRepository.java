package com.shelfy.api.auth;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmailChangeTokenRepository extends JpaRepository<EmailChangeTokenEntity, UUID> {

  Optional<EmailChangeTokenEntity> findByTokenHash(String tokenHash);

  Optional<EmailChangeTokenEntity>
      findFirstByUser_IdAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(UUID userId, Instant now);

  @Modifying
  @Query(
      "update EmailChangeTokenEntity token set token.used = true where token.user.id = :userId and token.used = false")
  int markAllUsedByUserId(@Param("userId") UUID userId);

  @Modifying
  @Query("delete from EmailChangeTokenEntity token where token.expiresAt < :cutoff")
  int deleteExpiredBefore(@Param("cutoff") Instant cutoff);
}
